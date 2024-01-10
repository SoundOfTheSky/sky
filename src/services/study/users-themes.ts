import { DB, DBTable, TableDefaults, convertFromBoolean, convertToBoolean, defaultColumns } from '@/services/db';
import { ValidationError } from '@/utils';
import { usersTable } from '@/services/session/user';
import { usersSubjectsTable } from '@/services/study/users-subjects';
import { Theme, themesTable } from '@/services/study/themes';

// DB.prepare(`ALTER TABLE users_themes RENAME TO temp`).run();

export type UserTheme = TableDefaults & {
  userId: number;
  themeId: number;
  needUnlock: boolean;
};

export class UsersThemesTable extends DBTable<UserTheme> {
  constructor(table: string) {
    super(table, {
      ...defaultColumns,
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
      themeId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: 'themes',
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
      needUnlock: {
        type: 'INTEGER',
        required: true,
        to: convertToBoolean,
        from: convertFromBoolean,
      },
    });
  }
  queries = {
    getThemeAndThemeData: DB.prepare<unknown, [number]>(
      `SELECT *, ut.id as id FROM ${this.name} ut JOIN ${themesTable.name} tt ON tt.id=ut.theme_id WHERE user_id = ?`,
    ),
    countByUserAndTheme: DB.prepare<{ a: number }, [number, number]>(
      `SELECT COUNT(*) a FROM ${this.name} WHERE user_id = ? AND theme_id = ?`,
    ),
    removeFromUser: DB.prepare<unknown, [number, number]>(
      `DELETE FROM ${this.name} WHERE user_id = ? AND theme_id = ?`,
    ),
  };
  getAllByUser(userId: number) {
    const themes = this.queries.getThemeAndThemeData
      .all(userId)
      .map((el) => themesTable.convertFrom(this.convertFrom(el))) as (Theme & UserTheme)[];
    const needUnlock = themes.filter((t) => t.needUnlock);
    if (needUnlock.length > 0) usersSubjectsTable.unlock(userId);
    for (const theme of needUnlock) this.update(theme.id, { needUnlock: false });
    const reviewsAndLessons = usersSubjectsTable.getUserReviewsAndLessons(userId);
    return themes.map((theme) => ({
      id: theme.themeId,
      title: theme.title,
      created: theme.created,
      updated: theme.updated,
      lessons: reviewsAndLessons[theme.themeId]?.lessons ?? [],
      reviews: reviewsAndLessons[theme.themeId]?.reviews ?? {},
    }));
  }
  addToUser(userId: number, themeId: number) {
    if (this.queries.countByUserAndTheme.get(userId, themeId)!.a !== 0)
      throw new ValidationError('User already have this theme');
    this.create({
      themeId,
      userId,
      needUnlock: true,
    });
  }
  removeFromUser(userId: number, themeId: number) {
    this.queries.removeFromUser.run(userId, themeId);
  }
}
export const usersThemesTable = new UsersThemesTable('users_themes');

// DB.prepare(`INSERT INTO users_themes SELECT *, 1 as need_unlock FROM temp`).run();
// DB.prepare(`DROP TABLE temp`).run();
