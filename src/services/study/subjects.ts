import { Query } from '@/services/db/query'
import { DEFAULT_COLUMNS, Table } from '@/services/db/table'
import { DBRow } from '@/services/db/types'
import TABLES from '@/services/tables'
import { StudySubject, StudySubjectDTO } from '@/sky-shared/study'

import { TableDefaults } from 'sky-shared/database'

export type StudySubjectTable = TableDefaults & {
  title: string
  theme_id: number
}

export class SubjectsTable extends Table<StudySubject, StudySubjectDTO> {
  public constructor() {
    super(
      TABLES.STUDY_SUBJECTS,
      {
        ...DEFAULT_COLUMNS,
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
        title: {
          type: 'TEXT',
          required: true,
        },
      },
      new Query<
        TableDefaults & {
          theme_id: number
          title: number
          questionsIds: number
          userSubjectId?: number
        }
      >(TABLES.STUDY_SUBJECTS, [
        `${TABLES.STUDY_SUBJECTS}.id`,
        `${TABLES.STUDY_SUBJECTS}.created`,
        `${TABLES.STUDY_SUBJECTS}.theme_id`,
        `${TABLES.STUDY_SUBJECTS}.title`,
        `us.id userSubjectId`,
        `GROUP_CONCAT(q.id) questionIds`,
        `MAX(${TABLES.STUDY_SUBJECTS}.updated, IIF(us.updated, us.updated, 0), q.updated) updated`,
      ])
        .join(
          `${TABLES.STUDY_QUESTIONS} q`,
          `q.subject_id = ${TABLES.STUDY_SUBJECTS}.id`,
        )
        .join(
          `${TABLES.STUDY_USERS_SUBJECTS} us`,
          `${TABLES.STUDY_SUBJECTS}.id = us.subject_id`,
          true,
        )
        .group(`${TABLES.STUDY_SUBJECTS}.id`),
    )
  }

  public convertFrom(data?: DBRow | null): StudySubject | undefined {
    if (!data) return;
    (data as unknown as StudySubject).questionIds = (data.questionIds as string)
      .split(',')
      .map(x => Number.parseInt(x))
    return super.convertFrom(data)
  }
}
export const subjectsTable = new SubjectsTable()
