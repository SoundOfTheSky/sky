import {
  convertFromArray,
  convertFromBoolean,
  convertToArray,
  convertToBoolean,
} from '@/services/db/convetrations';
import { DB } from '@/services/db/db';
import { Query } from '@/services/db/query';
import { DEFAULT_COLUMNS, TableWithUser } from '@/services/db/table';
import { usersSubjectsTable } from '@/services/study/users-subjects';
import TABLES from '@/services/tables';
import { Changes, TableDefaults } from '@/sky-shared/db';
import { StudyAnswer, StudyAnswerDTO } from '@/sky-shared/study';

export class AnswersTable extends TableWithUser<StudyAnswer, StudyAnswerDTO> {
  public $deleteByUserTheme = DB.prepare<
    unknown,
    {
      themeId: number;
      userId: number;
    }
  >(
    `DELETE FROM ${this.name} WHERE id IN (
      SELECT a.id FROM ${this.name} a
      JOIN ${TABLES.STUDY_SUBJECTS} s ON s.id == a.subject_id
      WHERE s.theme_id = $themeId AND a.user_id = $userId)`,
  );

  public constructor() {
    super(
      TABLES.STUDY_ANSWERS,
      {
        ...DEFAULT_COLUMNS,
        correct: {
          type: 'INTEGER',
          required: true,
          from: convertFromBoolean,
          to: convertToBoolean,
        },
        answers: {
          type: 'TEXT',
          from: convertFromArray,
          to: convertToArray,
        },
        took: {
          type: 'INTEGER',
          required: true,
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
      },
      new Query<
        TableDefaults & {
          user_id: number;
          subject_id: number;
          correct: number;
          answers: string;
          took: number;
          theme_id: number;
        }
      >(TABLES.STUDY_ANSWERS, [
        `${TABLES.STUDY_ANSWERS}.id`,
        `${TABLES.STUDY_ANSWERS}.updated`,
        `${TABLES.STUDY_ANSWERS}.created`,
        `${TABLES.STUDY_ANSWERS}.subject_id`,
        `${TABLES.STUDY_ANSWERS}.correct`,
        `${TABLES.STUDY_ANSWERS}.answers`,
        `${TABLES.STUDY_ANSWERS}.took`,
        `s.theme_id`,
        `${TABLES.STUDY_ANSWERS}.user_id`,
      ]).join(
        `${TABLES.STUDY_SUBJECTS} s`,
        `s.id = ${TABLES.STUDY_ANSWERS}.subject_id`,
      ),
    );
  }

  public create(data: StudyAnswerDTO): Changes {
    data.answers = data.answers?.filter(
      (x) => !['wrong', 'correct'].includes(x.toLowerCase()),
    );
    let changes: Changes;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    DB.transaction(() => {
      changes = super.create(data);
      changes.changes += usersSubjectsTable.answer(data).changes;
    })();
    return changes!;
  }
}
export const answersTable = new AnswersTable();
