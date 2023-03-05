import { DB, DBTable, TableDefaults } from '../../db';
import { ValidationError } from '../../utils';
import { usersTable, UsersTable } from '../auth';
import { usersSubjectsTable, UsersSubjectsTable } from './users-subjects';
import { Theme, themesTable, ThemesTable } from './themes';

export type UserTheme = TableDefaults & {
  userId: number;
  themeId: number;
};
export class UsersThemesTable extends DBTable<UserTheme> {
  private dependencyTables;
  constructor(
    table: string,
    dependencyTables: {
      themesTable: ThemesTable;
      usersSubjectsTable: UsersSubjectsTable;
      usersTable: UsersTable;
    },
  ) {
    super(table, {
      userId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: dependencyTables.usersTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
      themeId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: 'themes',
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
    });
    this.dependencyTables = dependencyTables;
  }
  getAllByUser(userId: number) {
    const themes = DB.prepare(
      `SELECT * FROM ${this.name} ut JOIN ${this.dependencyTables.themesTable.name} tt ON tt.id=ut.theme_id WHERE user_id = ?`,
    )
      .all(userId)
      .map((el) => this.dependencyTables.themesTable.convertFrom(this.convertFrom(el))) as (Theme & UserTheme)[];
    const lessons = this.dependencyTables.usersSubjectsTable.getUserLessons(userId);
    const reviews = this.dependencyTables.usersSubjectsTable.getUserReviews(userId);
    return themes.map((theme) => ({
      id: theme.themeId,
      title: theme.title,
      created: theme.created,
      updated: theme.updated,
      lessons: lessons.find((l) => l.themeId === theme.themeId)?.ids ?? [],
      reviews: reviews
        .filter((r) => r.themeId === theme.themeId)
        .map((r) => ({
          ids: r.ids,
          time: r.time,
        })),
    }));
  }
  addToUser(userId: number, themeId: number) {
    if (
      DB.prepare(`SELECT COUNT(1) FROM ${this.name} WHERE user_id = ? AND theme_id = ?`).get(userId, themeId)![
        'COUNT(1)'
      ] !== 0
    )
      throw new ValidationError('User already have this theme');

    this.create({
      themeId,
      userId,
    });
    this.dependencyTables.usersSubjectsTable.fixUserLessons(userId, themeId);
  }
  removeFromUser(userId: number, themeId: number) {
    DB.prepare(`DELETE FROM ${this.name} WHERE user_id = ? AND theme_id = ?`).run(userId, themeId);
  }
}
export const usersThemesTable = new UsersThemesTable('users_themes', {
  themesTable,
  usersSubjectsTable,
  usersTable,
});
