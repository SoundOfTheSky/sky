import {
  convertFromBoolean,
  convertToBoolean,
  convertToDate,
  DB,
  DBTable,
  convertFromDate,
  convertFromArray,
  convertToArray,
} from '@/services/db';
import { usersTable } from '@/services/session/user';
import { subjectsTable } from '@/services/study/subjects';

export type UserAnswer = {
  id: number;
  created: number;
  correct: boolean;
  subjectId: number;
  userId: number;
  answers: string[];
  took: number;
};
export class UsersAnswersTable extends DBTable<UserAnswer> {
  constructor(table: string) {
    super(table, {
      id: {
        type: 'INTEGER',
        autoincrement: true,
        primaryKey: true,
      },
      created: {
        type: 'TEXT',
        default: 'current_timestamp',
        from: convertFromDate,
        to: convertToDate,
      },
      correct: {
        type: 'INTEGER',
        required: true,
        from: convertFromBoolean,
        to: convertToBoolean,
      },
      answers: {
        type: 'TEXT',
        required: true,
        from: convertFromArray,
        to: convertToArray,
      },
      took: {
        type: 'INTEGER',
        required: true,
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
    getUserStats: DB.prepare<
      {
        created: number;
        theme_id: number;
        subject_id: number;
        correct: 1 | 0;
        answers: string;
        took: number;
      },
      [number, string, string]
    >(
      `SELECT unixepoch(ua.created) created, s.theme_id, ua.subject_id, ua.correct, ua.answers, ua.took
      FROM ${this.name} ua
      JOIN ${subjectsTable.name} s ON s.id = ua.subject_id
      WHERE ua.user_id = ? AND ua.created > ? AND ua.created < ?`,
    ),
    deleteByUserTheme: DB.prepare<unknown, [number, number]>(
      `DELETE FROM ${this.name} WHERE id IN (
        SELECT a.id FROM ${this.name} a
        JOIN ${subjectsTable.name} s ON s.id == a.subject_id
        WHERE a.user_id = ? AND s.theme_id = ?)`,
    ),
  };
  getUserStats(userId: number, start: number, end?: number) {
    return this.queries.getUserStats
      .all(userId, convertToDate(new Date(start * 1000))!, convertToDate(end ? new Date(end * 1000) : new Date())!)
      .map((x) => ({
        created: x.created,
        themeId: x.theme_id,
        subjectId: x.subject_id,
        correct: x.correct === 1,
        answers: convertFromArray(x.correct) as string[],
        took: x.took,
      }));
  }
}
export const usersAnswersTable = new UsersAnswersTable('users_answers');
