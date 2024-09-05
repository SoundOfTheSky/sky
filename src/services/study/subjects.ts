import { DB, DBTable, DEFAULT_COLUMNS } from '@/services/db';
import TABLES from '@/services/tables';
import { DBRow } from '@/sky-shared/db';
import { StudySubject, StudySubjectDTO } from '@/sky-shared/study';

export class SubjectsTable extends DBTable<StudySubject, StudySubjectDTO> {
  /**
   * Updated will not work if any related ids were deleted!
   * Questions deletion trigger update
   * User subject id will not trigger update, because every time user deletes it's data
   * Everyone will need to reload subjects
   * May need a work around in future. Probably an "DELETED" field
   */
  protected $getById = DB.prepare<DBRow, [number]>(
    `SELECT 
      s.id,
      s.created,
      s.theme_id,
      s.title,
      us.id userSubjectId,
      GROUP_CONCAT(q.id) question_ids,
      MAX(s.updated, IIF(us.created, us.created, 0), q.created) updated
    FROM ${TABLES.STUDY_SUBJECTS} s
    LEFT JOIN ${TABLES.STUDY_USERS_SUBJECTS} us ON s.id = us.subject_id
    JOIN ${TABLES.STUDY_QUESTIONS} q ON q.subject_id = s.id
    WHERE s.id = ?
    GROUP BY s.id`,
  );

  public constructor() {
    super(TABLES.STUDY_SUBJECTS, {
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
    });
  }
}
export const subjectsTable = new SubjectsTable();
