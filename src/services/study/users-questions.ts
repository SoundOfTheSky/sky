import { convertFromArray, convertToArray, DBTableWithUser, DEFAULT_COLUMNS } from '@/services/db';
import TABLES from '@/services/tables';
import { StudyUserQuestion } from '@/sky-shared/study';

export class UsersQuestionsTable extends DBTableWithUser<StudyUserQuestion> {
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
    });
  }
}
export const usersQuestionsTable = new UsersQuestionsTable();
