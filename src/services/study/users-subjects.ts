import { DB, DBTable, TableDefaults } from '../../db';
import { ValidationError } from '../../utils';
import { usersTable, UsersTable } from '../auth';
import { questionsTable, QuestionsTable } from './questions';
import { usersQuestionsTable, UsersQuestionsTable } from './users-questions';
import { SRSTable, srsTable } from './srs';
import { subjectDependenciesTable, SubjectDependenciesTable } from './subject-dependencies';
import { subjectsTable, SubjectsTable } from './subjects';
import { usersAnswersTable, UsersAnswersTable } from './users-answers';

export type UserSubject = TableDefaults & {
  stage: number;
  nextReview?: number | undefined; // hours
  userId: number;
  subjectId: number;
};
export class UsersSubjectsTable extends DBTable<UserSubject> {
  private dependentTables;
  constructor(
    table: string,
    dependentTables: {
      usersQuestionsTable: UsersQuestionsTable;
      subjectsTable: SubjectsTable;
      questionsTable: QuestionsTable;
      srsTable: SRSTable;
      subjectDependenciesTable: SubjectDependenciesTable;
      usersTable: UsersTable;
      usersAnswersTable: UsersAnswersTable;
    },
  ) {
    super(table, {
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
          table: dependentTables.usersTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
      subjectId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: dependentTables.subjectsTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
    });
    this.dependentTables = dependentTables;
  }
  getUserReviews(userId: number) {
    const now = Math.floor(Date.now() / 3_600_000);
    const weekLater = now + 336;
    return DB.prepare(
      `SELECT next_review, theme_id, GROUP_CONCAT(subject_id) ids
      FROM ${this.name} JOIN ${this.dependentTables.subjectsTable.name}
      ON ${this.dependentTables.subjectsTable.name}.id = ${this.name}.subject_id 
      WHERE user_id = ? AND next_review < ? GROUP BY theme_id, next_review`,
    )
      .all(userId, weekLater)
      .map((el) => ({
        ids: (el['ids'] as string).split(',').map((el: string) => +el),
        time: el['next_review'] as number,
        themeId: el['theme_id'] as number,
      }));
  }
  getUserLessons(userId: number) {
    return DB.prepare(
      `SELECT theme_id, GROUP_CONCAT(subject_id) ids
      FROM ${this.name} JOIN ${this.dependentTables.subjectsTable.name} ON ${this.dependentTables.subjectsTable.name}.id = ${this.name}.subject_id 
      WHERE user_id = ? AND stage = 0 GROUP BY theme_id`,
    )
      .all(userId)
      .map((el) => ({
        ids: (el['ids'] as string).split(',').map((el: string) => +el),
        themeId: el['theme_id'] as number,
      }));
  }
  fixUserLessons(userId: number, themeId: number) {
    const knownSubjects = DB.prepare(
      `SELECT ${this.name}.subject_id
      FROM ${this.name}
      JOIN ${this.dependentTables.subjectsTable.name}
      ON ${this.name}.subject_id = ${this.dependentTables.subjectsTable.name}.id
      WHERE user_id = ? AND theme_id = ?`,
    )
      .all(userId, themeId)
      .map((el) => el['subject_id'])
      .join(',');
    const unknownSubjects = DB.prepare(
      `SELECT id
        FROM ${this.dependentTables.subjectsTable.name}
        WHERE 
        id NOT IN (${knownSubjects}) AND theme_id = ?`,
    )
      .all(themeId)
      .map((el) => el['id'] as number);
    const hasNotKnownDeps = new Set(
      DB.prepare(
        `SELECT subject_id
      FROM ${this.dependentTables.subjectDependenciesTable.name}
      WHERE subject_id IN (${unknownSubjects.join(',')})
      AND dependency_id NOT IN (${knownSubjects}) GROUP BY subject_id`,
      )
        .all()
        .map((el) => el['subject_id'] as number),
    );
    const available = unknownSubjects.filter((id) => !hasNotKnownDeps.has(id));
    const lessons = available.filter((subjectId) =>
      DB.prepare(
        `SELECT sum(subject_stats.stage>=srs.ok)*100/COUNT(*)<subject_dependencies.percent x
      FROM ${this.dependentTables.subjectDependenciesTable.name} subject_dependencies
      JOIN ${this.dependentTables.subjectsTable.name} dep ON dep.id = subject_dependencies.dependency_id
      JOIN ${this.dependentTables.srsTable.name} srs ON srs.id = dep.srs_id
      JOIN ${this.name} subject_stats ON subject_stats.subject_id = dep.id
      WHERE subject_dependencies.subject_id = ? AND subject_stats.user_id = ? GROUP BY subject_dependencies.percent
    `,
      )
        .all(subjectId, userId)
        .every((el) => el['x'] !== 1),
    );
    for (const subjectId of lessons) this.unlock(subjectId, userId);
  }
  getBySubjectAndUser(subjectId: number, userId: number) {
    return this.convertFrom(
      DB.prepare(
        `SELECT * FROM ${this.name} 
      WHERE ${this.name}.subject_id = ? AND user_id = ?
    `,
      ).get(subjectId, userId),
    );
  }
  getReview(subjectId: number, userId: number) {
    const subjectStats = DB.prepare(
      `SELECT s.id, s.questions_have_to_answer, s.title, us.next_review, us.stage, s.srs_id FROM ${this.name} us 
      JOIN ${this.dependentTables.subjectsTable.name} s ON s.id = us.subject_id 
      WHERE subject_id = ? AND user_id = ?`,
    ).get(subjectId, userId);
    if (!subjectStats) return;
    return this.parseToDTO(subjectStats);
  }
  answer(subjectId: number, userId: number, correct: boolean) {
    const subject = this.dependentTables.subjectsTable.get(subjectId);
    if (!subject) throw new ValidationError('Subject not found');
    const subjectStats = this.getBySubjectAndUser(subjectId, userId);
    if (!subjectStats) throw new ValidationError('Subject not unlocked');
    const now = Math.floor(Date.now() / 3_600_000);
    if (subjectStats.nextReview && subjectStats.nextReview > now)
      throw new ValidationError('Subject is not available for review');
    const SRS = this.dependentTables.srsTable.get(subject.srsId)!;
    if (correct) {
      if (subjectStats.stage === SRS.timings.length + 1) throw new ValidationError('Already at max stage');
      const stage = subjectStats.stage + 1;
      this.dependentTables.usersAnswersTable.create({
        correct: true,
        subjectId: subjectId,
        userId: userId,
      });
      this.update(subjectStats.id, {
        stage,
        nextReview: now + SRS.timings[stage - 1]!,
      });
      if (stage === SRS.ok) this.unlockForDependency(subjectId, userId, subject.themeId);
    } else {
      const stage = Math.max(1, subjectStats.stage - 2);
      this.dependentTables.usersAnswersTable.create({
        correct: false,
        subjectId: subjectId,
        userId: userId,
      });
      this.update(subjectStats.id, {
        stage,
        nextReview: now + SRS.timings[stage - 1]!,
      });
    }
  }
  unlock(subjectId: number, userId: number) {
    const questions = this.dependentTables.questionsTable.getBySubject(subjectId);
    this.create({
      stage: 0,
      subjectId,
      userId,
    });
    for (const question of questions)
      this.dependentTables.usersQuestionsTable.create({
        questionId: question.id,
        userId,
      });
  }
  unlockForDependency(depId: number, userId: number, themeId: number) {
    const known = DB.prepare(
      `SELECT ${this.name}.subject_id
        FROM ${this.name}
        JOIN ${this.dependentTables.subjectsTable.name}
        ON ${this.name}.subject_id = ${this.dependentTables.subjectsTable.name}.id
        WHERE user_id = ? AND theme_id = ?`,
    )
      .all(userId, themeId)
      .map((el) => el['subject_id'])
      .join(',');
    const unknownDependent = DB.prepare(
      `SELECT subject_id
      FROM ${this.dependentTables.subjectDependenciesTable.name} 
      WHERE dependency_id = ? AND subject_id NOT IN (${known})`,
    )
      .all(depId)
      .map((el) => el['subject_id'] as number);
    const hasNotKnownDeps = new Set(
      DB.prepare(
        `SELECT subject_id
      FROM ${this.dependentTables.subjectDependenciesTable.name}
      WHERE subject_id IN (${unknownDependent.join(',')})
      AND dependency_id NOT IN (${known}) GROUP BY subject_id`,
      )
        .all()
        .map((el) => el['subject_id'] as number),
    );
    const available = unknownDependent.filter((id) => !hasNotKnownDeps.has(id));
    const lessons = available.filter((subjectId) =>
      DB.prepare(
        `SELECT sum(subject_stats.stage>=srs.ok)*100/COUNT(*)<subject_dependencies.percent x
      FROM ${this.dependentTables.subjectDependenciesTable.name} subject_dependencies
      JOIN ${this.dependentTables.subjectsTable.name} dep ON dep.id = subject_dependencies.dependency_id
      JOIN ${this.dependentTables.srsTable.name} srs ON srs.id = dep.srs_id
      JOIN ${this.name} subject_stats ON subject_stats.subject_id = dep.id
      WHERE subject_dependencies.subject_id = ? AND subject_stats.user_id = ? GROUP BY subject_dependencies.percent
    `,
      )
        .all(subjectId, userId)
        .every((el) => el['x'] !== 1),
    );
    for (const subjectId of lessons) this.unlock(subjectId, userId);
  }
  search(themeIds: number[], query: string) {
    const q = `%${query}%`;
    const themeIdsString = themeIds.join(',');
    const results = DB.prepare(
      `SELECT 
        s.id,
        s.title
      FROM ${this.dependentTables.subjectsTable.name} s
      JOIN ${this.dependentTables.questionsTable.name} q ON q.subject_id = s.id
      WHERE s.theme_id IN (${themeIdsString})
        AND (s.title LIKE ?
          OR q.answers LIKE ?
          OR q.answers LIKE ?
          OR q.answers LIKE ?)
      GROUP BY s.id`,
    ).all(query, query, `|${q}`, `${q}|`);
    if (results.length < 40)
      results.push(
        ...DB.prepare(
          `SELECT 
        s.id,
        s.title
      FROM ${this.dependentTables.subjectsTable.name} s
      JOIN ${this.dependentTables.questionsTable.name} q ON q.subject_id = s.id
      WHERE s.theme_id IN (${themeIdsString})
        AND s.id NOT IN (${results.map((x) => x['id'] as number).join(',')})
        AND (s.title LIKE ?
          OR q.answers LIKE ?
          OR q.question LIKE ?)
      GROUP BY s.id
      LIMIT ${40 - results.length}`,
        ).all(q, q, q),
      );
    return results.map(this.parseToSimpleDTO.bind(this));
  }
  getAllByThemes(themeIds: number[], page: number) {
    const themeIdsString = themeIds.join(',');
    const results = DB.prepare(
      `SELECT 
        s.id,
        s.questions_have_to_answer,
        s.title,
        s.srs_id
      FROM ${this.dependentTables.subjectsTable.name} s
      WHERE s.theme_id IN (${themeIdsString})
      LIMIT 40 OFFSET ${40 * (page - 1)}`,
    ).all();
    return results.map(this.parseToSimpleDTO.bind(this));
  }
  parseToDTO(x: Record<string, unknown>) {
    return {
      id: x['id'] as number,
      title: x['title'] as string,
      nextReview: x['next_review'] as number | null,
      stage: x['stage'] as number | null,
      questionsHaveToAnswer: (x['questions_have_to_answer'] as number | undefined) ?? undefined,
      srsId: x['srs_id'] as number,
      questionIds: this.dependentTables.questionsTable.getBySubject(x['id'] as number).map((q) => q.id),
    };
  }
  parseToSimpleDTO(x: Record<string, unknown>) {
    const answers = new Set<string>();
    for (const q of this.dependentTables.questionsTable.getBySubject(x['id'] as number)) answers.add(q.answers[0]!);
    return {
      id: x['id'] as number,
      title: x['title'] as string,
      answers: [...answers],
    };
  }
}
export const usersSubjectsTable = new UsersSubjectsTable('users_subjects', {
  usersQuestionsTable,
  subjectsTable,
  questionsTable,
  srsTable,
  subjectDependenciesTable,
  usersTable,
  usersAnswersTable,
});
