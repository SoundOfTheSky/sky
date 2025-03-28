import { ObjectCamelToSnakeCase, ValidationError } from '@softsky/utils'

import { database } from '@/services/db/database'
import { DEFAULT_COLUMNS, TableWithUser } from '@/services/db/table'
import { usersThemesTable } from '@/services/study/users-themes'
import TABLES from '@/services/tables'
import { Changes } from '@/sky-shared/database'
import { srs, StudyAnswerDTO, StudyUserSubject } from '@/sky-shared/study'

export type StudyUserSubjectTable = ObjectCamelToSnakeCase<StudyUserSubject>

export class UserSubjectsTable extends TableWithUser<StudyUserSubject> {
  public $deleteByUserTheme = database.prepare<
    unknown,
    { themeId: number; userId: number }
  >(
    `DELETE FROM ${this.name} WHERE id IN (
      SELECT a.id FROM ${this.name} a
      JOIN ${TABLES.STUDY_SUBJECTS} s ON s.id == a.subject_id
      WHERE s.theme_id = $themeId AND a.user_id = $userId)`,
  )

  protected $getUserReviews = database.prepare<
    { next_review: number; theme_id: number; ids: string },
    { userId: number }
  >(
    `SELECT s.theme_id, us.next_review, GROUP_CONCAT(us.subject_id) ids
  FROM ${this.name} us
  JOIN ${TABLES.STUDY_SUBJECTS} s ON s.id = us.subject_id 
  WHERE us.user_id = $userId AND (us.next_review IS NOT NULL OR us.stage = 0)
  GROUP BY theme_id, next_review ORDER BY next_review ASC`,
  )

  protected $getUnlockables = database.prepare<
    { id: number },
    { userId: number }
  >(
    `SELECT id FROM (
      SELECT SUM(locks) locks, id FROM (
        SELECT sd.subject_id IS NOT NULL AND (ssDep.stage IS NULL OR SUM(ssDep.stage>=5)*100/COUNT(*)<sd.percent) locks, s.id
        FROM ${TABLES.STUDY_SUBJECTS} s
        JOIN ${TABLES.STUDY_USERS_THEMES} ut ON ut.theme_id = s.theme_id AND ut.user_id = $userId
        LEFT JOIN ${this.name} ss ON ss.subject_id = s.id AND ss.user_id = $userId
        LEFT JOIN ${TABLES.STUDY_SUBJECT_DEPS} sd ON sd.subject_id = s.id
        LEFT JOIN ${this.name} ssDep ON ssDep.subject_id = sd.dependency_id AND ssDep.user_id = $userId
        LEFT JOIN ${TABLES.STUDY_SUBJECTS} dep ON dep.id = sd.dependency_id
        WHERE ss.subject_id IS NULL GROUP BY s.id, sd.percent)
      GROUP BY id)
    WHERE locks = 0`,
  )

  protected $getSubjectData = database.prepare<
    { next_review?: number; stage: number },
    { subjectId: number; userId: number }
  >(
    `SELECT next_review, stage FROM ${this.name} WHERE subject_id = $subjectId AND user_id = $userId`,
  )

  protected $updateStage = database.prepare<
    undefined,
    {
      nextReview: number | null
      stage: number
      subjectId: number
      userId: number
    }
  >(
    `UPDATE ${this.name} SET next_review=$nextReview, stage=$stage WHERE subject_id=$subjectId AND user_id=$userId`,
  )

  public constructor() {
    super(TABLES.STUDY_USERS_SUBJECTS, {
      ...DEFAULT_COLUMNS,
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
          table: TABLES.USERS,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
      subjectId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: TABLES.STUDY_SUBJECTS,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
    })
  }

  /**
   * Try to unlock new subjects for user
   */
  public unlock(userId: number) {
    for (const { id } of this.$getUnlockables.all({ userId }))
      this.create({
        stage: 0,
        subjectId: id,
        userId,
      })
  }

  /**
   * Get all available reviews for user
   */
  public getUserReviewsAndLessons(userId: number) {
    const data = new Map<
      number,
      { reviews: Record<number, number[]>; lessons: number[] }
    >()
    const userReviews = this.$getUserReviews.all({ userId })
    for (const element of userReviews) {
      let theme = data.get(element.theme_id)
      if (!theme) {
        theme = { reviews: {}, lessons: [] }
        data.set(element.theme_id, theme)
      }
      const ids = element.ids.split(',').map((x) => +x)
      if (element.next_review) theme.reviews[element.next_review] = ids
      else theme.lessons = ids
    }
    return data
  }

  /** Register an answer for subject */
  public answer(data: StudyAnswerDTO): Changes {
    const subject = this.$getSubjectData.get(data)
    if (!subject) throw new ValidationError('Subject not found')
    const time = ~~(new Date(data.created).getTime() / 3_600_000)
    if (subject.next_review && subject.next_review > time)
      throw new ValidationError('Subject is not available for review')
    const stage = Math.max(
      1,
      Math.min(srs.length + 1, subject.stage + (data.correct ? 1 : -2)),
    )
    const changes = this.$updateStage.run({
      nextReview: stage >= srs.length ? null : time + srs[stage - 1]!,
      stage,
      subjectId: data.subjectId,
      userId: data.userId,
    })
    if (data.correct && stage === 5)
      changes.changes += usersThemesTable.$setNeedUnlock.run({
        needUnlock: 1,
        userId: data.userId,
      }).changes
    return changes
  }
}

export const usersSubjectsTable = new UserSubjectsTable()
