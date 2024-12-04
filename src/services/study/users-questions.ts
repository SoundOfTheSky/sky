import { convertFromArray, convertToArray } from '@/services/db/convetrations'
import { database } from '@/services/db/database'
import { DEFAULT_COLUMNS, TableWithUser } from '@/services/db/table'
import TABLES from '@/services/tables'
import { StudyUserQuestion } from '@/sky-shared/study'

export class UsersQuestionsTable extends TableWithUser<StudyUserQuestion> {
  public $deleteByUserTheme = database.prepare<
    unknown,
    { themeId: number, userId: number }
  >(
    `DELETE FROM ${this.name} WHERE id IN (
      SELECT a.id FROM ${this.name} a
      JOIN ${TABLES.STUDY_QUESTIONS} q ON q.id == a.question_id
      JOIN ${TABLES.STUDY_SUBJECTS} s ON s.id == q.subject_id
      WHERE s.theme_id = $themeId AND a.user_id = $userId)`,
  )

  public constructor() {
    super(TABLES.STUDY_USERS_QUESTIONS, {
      ...DEFAULT_COLUMNS,
      note: {
        type: 'TEXT',
      },
      synonyms: {
        type: 'TEXT',
        from: convertFromArray,
        to: convertToArray,
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
      questionId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: TABLES.STUDY_QUESTIONS,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
    })
  }
}
export const usersQuestionsTable = new UsersQuestionsTable()
