/* eslint-disable sonarjs/no-duplicate-string */
import { DB, DBRow, DBTable, TableDefaults, defaultColumns } from '@/services/db';
import { ValidationError } from '@/utils';
import { usersTable } from '@/services/session/user';
import { questionsTable } from '@/services/study/questions';
import { srsTable } from '@/services/study/srs';
import { subjectDependenciesTable } from '@/services/study/subject-dependencies';
import { subjectsTable } from '@/services/study/subjects';
import { usersAnswersTable } from '@/services/study/users-answers';
import { usersThemesTable } from '@/services/study/users-themes';
import { usersQuestionsTable } from '@/services/study/users-questions';

export type UserSubject = TableDefaults & {
  stage: number;
  nextReview?: number | undefined; // hours
  userId: number;
  subjectId: number;
};
export class UserSubjectsTable extends DBTable<UserSubject> {
  constructor() {
    super('users_subjects', {
      ...defaultColumns,
      stage: {
        type: 'INTEGER',
        required: true,
      },
      nextReview: {
        type: 'INTEGER',
      },
      userId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: usersTable.name,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
      subjectId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: subjectsTable.name,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
    });
  }
  queries = {
    getUserReviewsAndLessons: DB.prepare<
      { next_review: number; theme_id: number; stage: number; ids: string },
      [number]
    >(
      `SELECT next_review, theme_id, stage, GROUP_CONCAT(subject_id) ids
      FROM ${this.name} JOIN ${subjectsTable.name}
      ON ${subjectsTable.name}.id = ${this.name}.subject_id 
      WHERE user_id = ? AND (next_review IS NOT NULL OR stage = 0)
      GROUP BY theme_id, next_review ORDER BY next_review ASC`,
    ),
    getBySubjectAndUser: DB.prepare<DBRow, [number, number]>(
      `SELECT * FROM ${this.name} WHERE ${this.name}.subject_id = ? AND user_id = ?`,
    ),
    getSubject: DB.prepare<DBRow, [number, number | null]>(
      `SELECT s.id, s.title, us.next_review, us.stage, s.srs_id FROM ${subjectsTable.name} s 
      LEFT JOIN ${this.name} us ON s.id = us.subject_id 
      WHERE s.id = ? AND (user_id = ? OR user_id IS NULL)`,
    ),
    getUnlockables: DB.prepare<{ id: number }, [number, number]>(
      `SELECT id FROM (
        SELECT SUM(locks) locks, id FROM (
          SELECT sd.subject_id IS NOT NULL AND (ssDep.stage IS NULL OR SUM(ssDep.stage>=srs.ok)*100/COUNT(*)<sd.percent) locks, subject.id
          FROM ${subjectsTable.name} subject
          LEFT JOIN ${this.name} ss ON ss.subject_id = subject.id AND ss.user_id = ?
          LEFT JOIN ${subjectDependenciesTable.name} sd ON sd.subject_id = subject.id
          LEFT JOIN ${this.name} ssDep ON ssDep.subject_id = sd.dependency_id AND ssDep.user_id = ?
          LEFT JOIN ${subjectsTable.name} dep ON dep.id = sd.dependency_id
          LEFT JOIN ${srsTable.name} srs ON srs.id = dep.srs_id
          WHERE ss.subject_id IS NULL GROUP BY subject.id, sd.percent)
        GROUP BY id)
      WHERE locks = 0`,
    ),
  };
  getUserReviewsAndLessons(userId: number) {
    const data: Record<number, { reviews: Record<number, number[]>; lessons: number[] }> = {};
    const themes = this.queries.getUserReviewsAndLessons.all(userId);
    for (const el of themes) {
      let theme = data[el.theme_id];
      if (!theme) theme = data[el.theme_id] = { reviews: {}, lessons: [] };
      const ids = el.ids.split(',').map((x) => +x);
      if (el.stage === 0) theme.lessons = ids;
      else theme.reviews[el.next_review] = ids;
    }
    return data;
  }
  getBySubjectAndUser(subjectId: number, userId: number) {
    return this.convertFrom(this.queries.getBySubjectAndUser.get(subjectId, userId));
  }
  getSubject(subjectId: number, userId?: number) {
    const subject = this.queries.getSubject.get(subjectId, userId ?? null);
    if (!subject) return;
    return this.parseToDTO(subject);
  }
  answer(subjectId: number, userId: number, correct: boolean) {
    const subject = subjectsTable.get(subjectId);
    if (!subject) throw new ValidationError('Subject not found');
    const subjectStats = this.getBySubjectAndUser(subjectId, userId);
    if (!subjectStats) throw new ValidationError('Subject not unlocked');
    const now = ~~(Date.now() / 3_600_000);
    if (subjectStats.nextReview && subjectStats.nextReview > now)
      throw new ValidationError('Subject is not available for review');
    const SRS = srsTable.get(subject.srsId)!;
    if (correct) {
      if (subjectStats.stage === SRS.timings.length + 1) throw new ValidationError('Already at max stage');
      const stage = subjectStats.stage + 1;
      usersAnswersTable.create({
        correct: true,
        subjectId: subjectId,
        userId: userId,
      });
      this.update(subjectStats.id, {
        stage,
        nextReview: now + SRS.timings[stage - 1],
      });
      if (stage === SRS.ok) usersThemesTable.update(subject.themeId, { needUnlock: true });
    } else {
      const stage = Math.max(1, subjectStats.stage - 2);
      usersAnswersTable.create({
        correct: false,
        subjectId: subjectId,
        userId: userId,
      });
      this.update(subjectStats.id, {
        stage,
        nextReview: now + SRS.timings[stage - 1],
      });
    }
  }
  unlock(userId: number) {
    for (const { id } of this.queries.getUnlockables.all(userId, userId))
      this.create({
        stage: 0,
        subjectId: id,
        userId,
      });
  }
  search(themeIds: number[], query?: string, page = 1) {
    const PAGE_SIZE = 100;
    const statement = `SELECT 
        s.id id,
        s.title title,
        GROUP_CONCAT(q.answers) answers,
        GROUP_CONCAT(q.alternate_answers) alternate_answers,
        us.stage stage,
        us.next_review next_review,
        GROUP_CONCAT(uq.note) note,
        GROUP_CONCAT(uq.synonyms) synonyms
      FROM ${subjectsTable.name} s
      JOIN ${questionsTable.name} q ON q.subject_id = s.id
      LEFT JOIN ${usersSubjectsTable.name} us ON us.subject_id = s.id
      LEFT JOIN ${usersQuestionsTable.name} uq ON uq.question_id = q.id
      WHERE s.theme_id IN (${themeIds.join(',')}) ${
        query
          ? `AND
        (s.title LIKE ?2 OR
        q.answers LIKE ?2 OR
        uq.note LIKE ?2)`
          : ''
      }
      GROUP BY s.id
      LIMIT ${PAGE_SIZE} OFFSET ?1`;
    type Data = {
      id: number;
      title: string;
      answers: string;
      alternate_answers: string;
      stage?: number;
      next_review?: number;
      note?: string;
      synonyms?: string;
    };
    if (query) return DB.prepare<Data, [number, string]>(statement).all(PAGE_SIZE * (page - 1), `%${query}%`);
    return DB.prepare<Data, [number]>(statement).all(PAGE_SIZE * (page - 1));
  }
  parseToDTO(x: DBRow) {
    return {
      id: x['id'] as number,
      title: x['title'] as string,
      nextReview: x['next_review'] as number | null,
      stage: x['stage'] as number | null,
      srsId: x['srs_id'] as number,
      questionIds: questionsTable.getBySubject(x['id'] as number).map((q) => q.id),
    };
  }
  parseToSimpleDTO(x: DBRow) {
    const answers = new Set<string>();
    for (const q of questionsTable.getBySubject(x['id'] as number)) answers.add(q.answers[0]);
    return {
      id: x['id'] as number,
      title: x['title'] as string,
      answers: [...answers],
    };
  }
}

export const usersSubjectsTable = new UserSubjectsTable();
