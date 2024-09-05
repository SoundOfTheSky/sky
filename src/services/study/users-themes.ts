import { convertFromBoolean, convertToBoolean, DB, DBTableWithUser, DEFAULT_COLUMNS } from '@/services/db';
import { answersTable } from '@/services/study/answers';
import { usersQuestionsTable } from '@/services/study/users-questions';
import { usersSubjectsTable } from '@/services/study/users-subjects';
import TABLES from '@/services/tables';
import { Changes, TableDefaults } from '@/sky-shared/db';
import { StudyTheme } from '@/sky-shared/study';

export type UserTheme = TableDefaults & {
  userId: number;
  lessons: number[];
  reviews: Record<string, number[]>;
};
export class UsersThemesTable extends DBTableWithUser<UserTheme> {
  public $setNeedUnlock = DB.prepare<undefined, [0 | 1, number]>(
    `UPDATE ${this.name} SET need_unlock = ? WHERE user_id = ?`,
  );

  protected $getThemeAndThemeData = DB.prepare<
    { id: number; title: string; user_id?: number; need_unlock?: 0 | 1; created: string; updated: string },
    [number]
  >(
    `SELECT 
      t.id,
      t.title,
      ut.need_unlock,
      t.created,
      IIF(ut.updated>t.updated, ut.updated, t.updated) updated
    FROM ${TABLES.STUDY_THEMES} t
    LEFT JOIN ${this.name} ut ON t.id = ut.theme_id AND ut.user_id = ?`,
  );

  public constructor() {
    super(TABLES.STUDY_USERS_THEMES, {
      ...DEFAULT_COLUMNS,
      userId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: TABLES.USERS,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
      themeId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: TABLES.STUDY_THEMES,
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

  // It's unused but altered for consistency
  public getByIdUser(id: number, userId: number) {
    const item = super.getByIdUser(id, userId);
    if (item) {
      const reviewsAndLessons = usersSubjectsTable.getUserReviewsAndLessons(userId).get(item.id);
      if (reviewsAndLessons) Object.assign(item, reviewsAndLessons);
    }
    return item;
  }

  public getThemesData(userId: number) {
    const themes = this.$getThemeAndThemeData.all(userId).map((el) => this.convertFrom(el)) as unknown as {
      id: number;
      title: string;
      needUnlock?: boolean;
      created: Date;
      updated: Date;
    }[];
    if (themes.some((t) => t.needUnlock)) {
      usersSubjectsTable.unlock(userId);
      this.$setNeedUnlock.run(0, userId);
    }
    const reviewsAndLessons = usersSubjectsTable.getUserReviewsAndLessons(userId);
    for (let i = 0; i < themes.length; i++) {
      const theme = themes[i];
      const data = reviewsAndLessons.get(theme.id);
      if (data) Object.assign(theme, data);
      delete theme.needUnlock;
    }
    return themes as unknown as StudyTheme[];
  }

  public deleteByIdUser(id: number, userId: number): Changes {
    const changes = super.deleteByIdUser(id, userId);
    changes.changes += answersTable.$deleteByUserTheme.run(id, userId).changes;
    changes.changes += usersSubjectsTable.$deleteByUserTheme.run(id, userId).changes;
    changes.changes += usersQuestionsTable.deleteByIdUser(id, userId).changes;
    return changes;
  }
}
export const usersThemesTable = new UsersThemesTable();
