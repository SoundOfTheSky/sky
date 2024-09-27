import { Query } from '@/services/db/query';
import { Table, DEFAULT_COLUMNS } from '@/services/db/table';
import TABLES from '@/services/tables';
import { TableDefaults } from '@/sky-shared/db';
import { StudySubject, StudySubjectDTO } from '@/sky-shared/study';

export type StudySubjectTable = TableDefaults & {
  title: string;
  theme_id: number;
};

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
          theme_id: number;
          title: number;
          questionsIds: number;
          userSubjectId?: number;
        }
      >(TABLES.STUDY_SUBJECTS, [
        's.id',
        's.created',
        's.theme_id',
        's.title',
        'us.id userSubjectId',
        'GROUP_CONCAT(q.id) questionIds',
        'MAX(s.updated, IIF(us.created, us.created, 0), q.created) updated',
      ])
        .join(`${TABLES.STUDY_QUESTIONS} q`, 'q.subject_id = s.id')
        .join(`${TABLES.STUDY_USERS_SUBJECTS} us`, 's.id = us.subject_id', true)
        .groupBy('s.id'),
    );
  }
}
export const subjectsTable = new SubjectsTable();
