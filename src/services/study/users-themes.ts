import { DB, DBTable, TableDefaults, convertFromBoolean, convertToBoolean, DEFAULT_COLUMNS } from '@/services/db';
import { usersTable } from '@/services/session/user';
import { themesTable } from '@/services/study/themes';
import { usersAnswersTable } from '@/services/study/users-answers';
import { usersQuestionsTable } from '@/services/study/users-questions';
import { usersSubjectsTable } from '@/services/study/users-subjects';
import { ValidationError } from '@/utils';

// DB.prepare(`ALTER TABLE users_themes RENAME TO temp`).run();

export type UserTheme = TableDefaults & {
  userId: number;
  themeId: number;
  needUnlock: boolean;
};

export class UsersThemesTable extends DBTable<UserTheme> {
  constructor(table: string) {
    super(table, {
      ...DEFAULT_COLUMNS,
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
      `SELECT 
        t.id,
        t.title,
        ut.user_id,
        ut.need_unlock,
        t.created,
        IIF(ut.updated>t.updated, ut.updated, t.updated) updated
      FROM ${themesTable.name} t 
      LEFT JOIN ${this.name} ut ON t.id = ut.theme_id 
      WHERE (user_id = ? OR user_id IS NULL)`,
    ),
    countByUserAndTheme: DB.prepare<{ a: number }, [number, number]>(
      `SELECT COUNT(*) a FROM ${this.name} WHERE user_id = ? AND theme_id = ?`,
    ),
    deleteByUserTheme: DB.prepare<unknown, [number, number]>(
      `DELETE FROM ${this.name} WHERE user_id = ? AND theme_id = ?`,
    ),
    setNeedUnlock: DB.prepare<unknown, [number, number]>(
      `UPDATE ${this.name} SET need_unlock = 1 WHERE user_id = ? AND theme_id = ?`,
    ),
    removeNeedUnlock: DB.prepare<unknown, [number]>(`UPDATE ${this.name} SET need_unlock = 0 WHERE user_id = ?`),
  };
  getThemesData(userId: number) {
    const themes = this.queries.getThemeAndThemeData.all(userId).map((el) => this.convertFrom(el)) as unknown as {
      id: number;
      title: string;
      userId: number | undefined;
      needUnlock: boolean | undefined;
      created: Date;
      updated: Date;
    }[];
    if (themes.some((t) => t.needUnlock)) {
      usersSubjectsTable.unlock(userId);
      this.queries.removeNeedUnlock.run(userId);
    }
    const reviewsAndLessons = usersSubjectsTable.getUserReviewsAndLessons(userId);
    return themes.map((theme) => {
      const data = reviewsAndLessons.get(theme.id);
      return {
        id: theme.id,
        title: theme.title,
        created: theme.created,
        updated: theme.updated,
        ...(data && {
          lessons: data?.lessons,
          reviews: data?.reviews,
        }),
      };
    });
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
    this.queries.deleteByUserTheme.run(userId, themeId);
    usersAnswersTable.queries.deleteByUserTheme.run(userId, themeId);
    usersQuestionsTable.queries.deleteByUserTheme.run(userId, themeId);
    usersSubjectsTable.queries.deleteByUserTheme.run(userId, themeId);
  }
  setNeedUnlock(userId: number, themeId: number) {
    this.queries.setNeedUnlock.run(userId, themeId);
  }
}
export const usersThemesTable = new UsersThemesTable('users_themes');

// DB.prepare(`INSERT INTO users_themes SELECT *, 1 as need_unlock FROM temp`).run();
// DB.prepare(`DROP TABLE temp`).run();
