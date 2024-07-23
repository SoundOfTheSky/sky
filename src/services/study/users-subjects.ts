/* eslint-disable sonarjs/no-duplicate-string */
import { convertFromDate, convertToDate, DB, DBRow, DBTable, DEFAULT_COLUMNS, TableDefaults } from '@/services/db';
import { usersTable } from '@/services/session/user';
import { questionsTable } from '@/services/study/questions';
import { subjectDependenciesTable } from '@/services/study/subject-dependencies';
import { subjectsTable } from '@/services/study/subjects';
import { usersAnswersTable } from '@/services/study/users-answers';
import { usersQuestionsTable } from '@/services/study/users-questions';
import { usersThemesTable } from '@/services/study/users-themes';
import { ValidationError } from '@/utils';

export type UserSubject = TableDefaults & {
  stage: number;
  nextReview?: number | undefined; // hours
  userId: number;
  subjectId: number;
};
export class UserSubjectsTable extends DBTable<UserSubject> {
  constructor() {
    super('users_subjects', {
      ...DEFAULT_COLUMNS,
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
      FROM ${this.name} 
      JOIN ${subjectsTable.name} ON ${subjectsTable.name}.id = ${this.name}.subject_id 
      WHERE user_id = ? AND (next_review IS NOT NULL OR stage = 0)
      GROUP BY theme_id, next_review ORDER BY next_review ASC`,
    ),
    getBySubjectAndUser: DB.prepare<DBRow, [number, number]>(
      `SELECT * FROM ${this.name} WHERE ${this.name}.subject_id = ? AND user_id = ?`,
    ),
    getSubject: DB.prepare<DBRow, [number | null, number, number]>(
      `SELECT 
        s.id,
        s.title,
        s.theme_id,
        us.next_review,
        us.stage,
        s.srs_id,
        IIF(us.updated>s.updated, us.updated, s.updated) updated,
        GROUP_CONCAT(q.id) question_ids,
        s.created
      FROM ${subjectsTable.name} s
      LEFT JOIN ${this.name} us ON s.id = us.subject_id AND us.user_id = ?
      JOIN ${questionsTable.name} q ON q.subject_id = ?
      WHERE s.id = ?
      GROUP BY s.id`,
    ),
    // TODO: SRS OK IS BASICALLY IGNORED
    getUnlockables: DB.prepare<{ id: number }, [number, number]>(
      `SELECT id FROM (
        SELECT SUM(locks) locks, id FROM (
          SELECT sd.subject_id IS NOT NULL AND (ssDep.stage IS NULL OR SUM(ssDep.stage>=5)*100/COUNT(*)<sd.percent) locks, s.id
          FROM ${subjectsTable.name} s
          JOIN ${usersThemesTable.name} ut ON ut.theme_id = s.theme_id
          LEFT JOIN ${this.name} ss ON ss.subject_id = s.id AND ss.user_id = ?
          LEFT JOIN ${subjectDependenciesTable.name} sd ON sd.subject_id = s.id
          LEFT JOIN ${this.name} ssDep ON ssDep.subject_id = sd.dependency_id AND ssDep.user_id = ?
          LEFT JOIN ${subjectsTable.name} dep ON dep.id = sd.dependency_id
          WHERE ss.subject_id IS NULL GROUP BY s.id, sd.percent)
        GROUP BY id)
      WHERE locks = 0`,
    ),
    getUpdated: DB.prepare<{ id: number; updated: number }, [number, string, string]>(
      `SELECT s.id, unixepoch(IIF(us.updated>s.updated, us.updated, s.updated)) updated
      FROM ${subjectsTable.name} s
      JOIN ${this.name} us ON s.id = us.subject_id
      WHERE user_id = ? AND (us.updated > ? OR s.updated > ?)`,
    ),
    deleteByUserTheme: DB.prepare<unknown, [number, number]>(
      `DELETE FROM ${this.name} WHERE id IN (
        SELECT us.id FROM ${this.name} us
      JOIN ${subjectsTable.name} s ON s.id == us.subject_id
      WHERE us.user_id = ? AND s.theme_id = ?)`,
    ),
    updateStage: DB.prepare<unknown, [number | null, number, number, number]>(
      `UPDATE ${this.name} SET next_review=?, stage=? WHERE subject_id=? AND user_id=?`,
    ),
  };
  getUserReviewsAndLessons(userId: number) {
    const data = new Map<number, { reviews: Record<number, number[]>; lessons: number[] }>();
    const themes = this.queries.getUserReviewsAndLessons.all(userId);
    for (const el of themes) {
      let theme = data.get(el.theme_id);
      if (!theme) {
        theme = { reviews: {}, lessons: [] };
        data.set(el.theme_id, theme);
      }
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
    const subject = this.queries.getSubject.get(userId ?? null, subjectId, subjectId);
    if (!subject) return;
    return this.parseToDTO(subject);
  }
  answer(userId: number, subjectId: number, created: Date, answers: string[], correct: boolean, took: number) {
    const subject = this.getSubject(subjectId, userId);
    if (!subject) throw new ValidationError('Subject not found');
    const time = ~~(created.getTime() / 3_600_000);
    if (subject.nextReview && subject.nextReview > time)
      throw new ValidationError('Subject is not available for review');
    const SRS = srsMap[subject.srsId - 1];
    const stage = Math.max(1, Math.min(SRS.timings.length + 1, (subject.stage ?? 0) + (correct ? 1 : -2)));
    answers = answers.filter((x) => !['wrong', 'correct'].includes(x.toLowerCase()));
    usersAnswersTable.create({
      created,
      correct,
      subjectId,
      userId,
      answers,
      took,
    });
    this.queries.updateStage.run(
      stage >= SRS.timings.length ? null : time + SRS.timings[stage - 1],
      stage,
      subjectId,
      userId,
    );
    if (correct && stage === SRS.ok) usersThemesTable.setNeedUnlock(userId, subject.themeId);
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
      themeId: x['theme_id'] as number,
      questionIds: (x['question_ids'] as string).split(',').map((x) => Number.parseInt(x)),
      updated: convertFromDate(x['updated']),
      created: convertFromDate(x['created']),
    };
  }
  getUpdated(userId: number, updated: number) {
    const time = convertToDate(new Date(updated * 1000))!;
    return this.queries.getUpdated.values(userId, time, time) as [number, number][];
  }
}

export const usersSubjectsTable = new UserSubjectsTable();

export const srsMap = [
  {
    id: 1,
    ok: 5,
    timings: [4, 8, 23, 47, 167, 335, 719, 2879], // 9 levels
    title: 'Default',
  },
  {
    id: 2,
    ok: 5,
    timings: [2, 4, 8, 23, 47, 167, 335, 719, 2879], // 10 levels
    title: 'Fast unlock',
  },
  {
    id: 3,
    ok: 5,
    timings: [1, 2, 4, 8, 23, 47, 167, 335, 719, 2879], // 11 levels
    title: 'Hyper unlock',
  },
];
