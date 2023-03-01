import { convertFromBoolean, convertToBoolean, DB, DBTable, TableDefaults } from '../../db';
import { usersTable, UsersTable } from '../auth';
import { subjectsTable, SubjectsTable } from './subjects';

export type UserAnswer = TableDefaults & {
  correct: boolean;
  subjectId: number;
  userId: number;
};
export class UsersAnswersTable extends DBTable<UserAnswer> {
  private dependencyTables;
  constructor(
    table: string,
    dependencyTables: {
      usersTable: UsersTable;
      subjectsTable: SubjectsTable;
    },
  ) {
    super(table, {
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
          table: dependencyTables.usersTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
      subjectId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: dependencyTables.subjectsTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
    });
    this.dependencyTables = dependencyTables;
  }
  getUserStats(userId: number) {
    return DB.prepare(`SELECT * FROM ${this.name} WHERE user_id = ?`).all(userId).map(this.convertFrom.bind(this));
  }
}
export const usersAnswersTable = new UsersAnswersTable('users_answers', {
  subjectsTable,
  usersTable,
});
