import {
  convertFromBoolean,
  convertToBoolean,
  convertToDate,
  DB,
  DBTable,
  TableDefaults,
  defaultColumns,
} from '@/services/db';
import { usersTable } from '@/services/session/user';
import { subjectsTable } from '@/services/study/subjects';

export type UserAnswer = TableDefaults & {
  correct: boolean;
  subjectId: number;
  userId: number;
};
export class UsersAnswersTable extends DBTable<UserAnswer> {
  constructor(table: string) {
    super(table, {
      ...defaultColumns,
      correct: {
        type: 'INTEGER',
        required: true,
        from: convertFromBoolean,
        to: convertToBoolean,
      },
      userId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: usersTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
      subjectId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: subjectsTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
    });
  }
  queries = {
    getUserStats: DB.prepare<unknown, [number, string, string]>(
      `SELECT ua.created, s.id, ua.correct, s.theme_id FROM ${this.name} ua
      JOIN ${subjectsTable.name} s ON s.id = ua.subject_id
      WHERE user_id = ? AND ua.created >= ? AND ua.created <= ?`,
    ),
  };
  getUserStats(userId: number, start: number, end: number) {
    return this.queries.getUserStats.values(userId, convertToDate(new Date(start))!, convertToDate(new Date(end))!) as [
      string,
      number,
      number,
      number,
    ][];
  }
}
export const usersAnswersTable = new UsersAnswersTable('users_answers');
