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
      { created: number; theme_id: number; count: number },
      [number, number, string, string, number]
    >(
      `SELECT (unixepoch(ua.created)+?)/86400 created, s.theme_id theme_id, count(ua.subject_id) count
      FROM ${this.name} ua
      JOIN ${subjectsTable.name} s ON s.id = ua.subject_id
      WHERE ua.user_id = ? AND ua.created >= ? AND ua.created <= ?
      GROUP BY (unixepoch(ua.created)+?)/86400, s.theme_id;`,
    ),
  };
  getUserStats(userId: number, start: number, end: number, timezone = 0) {
    return this.queries.getUserStats.values(
      timezone,
      userId,
      convertToDate(new Date(start))!,
      convertToDate(new Date(end))!,
      timezone,
    ) as [string, number, number][];
  }
}
export const usersAnswersTable = new UsersAnswersTable('users_answers');
