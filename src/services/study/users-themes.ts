import { Optional, ValidationError } from '@softsky/utils'

import {
  convertFromBoolean,
  convertToBoolean,
} from '@/services/db/convetrations'
import { DEFAULT_COLUMNS, TableWithUser } from '@/services/db/table'
import { answersTable } from '@/services/study/answers'
import { usersQuestionsTable } from '@/services/study/users-questions'
import { usersSubjectsTable } from '@/services/study/users-subjects'
import TABLES from '@/services/tables'
import { StudyTheme } from '@/sky-shared/study'

import { DB } from 'services/db/database'
import { Changes, TableDefaults } from 'sky-shared/database'

export type UserTheme = TableDefaults & {
  userId: number
  themeId: number
  lessons: number[]
  reviews: Record<string, number[]>
  needUnlock: boolean
}
type UserThemesDTO = Optional<
  Omit<UserTheme, 'lessons' | 'reviews'>,
  'needUnlock' | keyof TableDefaults
>
export class UsersThemesTable extends TableWithUser<UserTheme, UserThemesDTO> {
  public $setNeedUnlock = DB.prepare<
    undefined,
    { needUnlock: 0 | 1, userId: number }
  >(
    `UPDATE ${this.name} SET need_unlock = $needUnlock WHERE user_id = $userId`,
  )

  protected $getThemeAndThemeData = DB.prepare<
    {
      id: number
      title: string
      user_id?: number
      need_unlock?: 0 | 1
      created: string
      updated: string
    },
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
  )

  protected $countByUserAndTheme = DB.prepare<
    { a: number },
    { userId: number, themeId: number }
  >(
    `SELECT COUNT(*) a FROM ${this.name} WHERE user_id = $userId AND theme_id = $themeId`,
  )

  protected $deleteByUserTheme = DB.prepare<
    undefined,
    { themeId: number, userId: number }
  >(`DELETE FROM ${this.name} WHERE theme_id = $themeId AND user_id = $userId`)

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
        to: convertToBoolean,
        from: convertFromBoolean,
        default: 1,
      },
    })
  }

  // It's unused but altered for consistency
  public getByIdUser(id: number, userId: number) {
    const item = super.getByIdUser(id, userId)
    if (item) {
      const reviewsAndLessons = usersSubjectsTable
        .getUserReviewsAndLessons(userId)
        .get(item.id)
      if (reviewsAndLessons) Object.assign(item, reviewsAndLessons)
    }
    return item
  }

  public getThemesData(userId: number) {
    const themes = this.$getThemeAndThemeData
      .all(userId)
      .map(element => this.convertFrom(element)) as unknown as {
      id: number
      title: string
      needUnlock?: boolean
      created: Date
      updated: Date
    }[]
    if (themes.some(t => t.needUnlock)) {
      usersSubjectsTable.unlock(userId)
      this.$setNeedUnlock.run({ needUnlock: 0, userId })
    }
    const reviewsAndLessons
      = usersSubjectsTable.getUserReviewsAndLessons(userId)
    for (let index = 0; index < themes.length; index++) {
      const theme = themes[index]!
      const data = reviewsAndLessons.get(theme.id)
      if (data) Object.assign(theme, data)
      delete theme.needUnlock
    }
    return themes as unknown as StudyTheme[]
  }

  public create(data: UserThemesDTO): Changes {
    if (this.$countByUserAndTheme.get(data)!.a !== 0)
      throw new ValidationError('User already have this theme')
    return super.create(data)
  }

  public deleteByIdUser(themeId: number, userId: number): Changes {
    const options = { themeId, userId }
    const changes = this.$deleteByUserTheme.run(options)
    changes.changes += answersTable.$deleteByUserTheme.run(options).changes
    changes.changes
      += usersSubjectsTable.$deleteByUserTheme.run(options).changes
    changes.changes
      += usersQuestionsTable.$deleteByUserTheme.run(options).changes
    return changes
  }
}
export const usersThemesTable = new UsersThemesTable()
