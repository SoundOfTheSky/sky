import { convertFromArray, convertFromBoolean, convertToArray, convertToBoolean } from '@/services/db/convetrations';
import { DB } from '@/services/db/db';
import { Query } from '@/services/db/query';
import { DEFAULT_COLUMNS, Table } from '@/services/db/table';
import TABLES from '@/services/tables';
import { TableDefaults } from '@/sky-shared/db';
import { StudyQuestion } from '@/sky-shared/study';
import { ObjectCamelToSnakeCase } from '@/sky-utils';

export type StudyQuestionTable = ObjectCamelToSnakeCase<
  TableDefaults & {
    answers: string;
    question: string;
    description: string;
    subjectId: string;
    alternateAnswers: string;
    choose: number;
  }
>;

export class QuestionsTable extends Table<StudyQuestion> {
  public constructor() {
    super(
      TABLES.STUDY_QUESTIONS,
      {
        ...DEFAULT_COLUMNS,
        answers: {
          type: 'TEXT',
          required: true,
          from: convertFromArray,
          to: convertToArray,
        },
        question: {
          type: 'TEXT',
          required: true,
          unique: true,
        },
        description: {
          type: 'TEXT',
          required: true,
          unique: true,
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
        alternateAnswers: {
          type: 'TEXT',
          from: (from) =>
            typeof from === 'string'
              ? (Object.fromEntries(from.split('|').map((el) => el.split('='))) as Record<string, string>)
              : undefined,
          to: (from: Record<string, string> | null | undefined) =>
            from
              ? Object.entries(from)
                  .map((el) => el.join('='))
                  .join('|')
              : from,
        },
        choose: {
          type: 'INTEGER',
          from: convertFromBoolean,
          to: convertToBoolean,
        },
      },
      new Query<
        TableDefaults & {
          subject_id: number;
          answers: string;
          question: string;
          description: string;
          alternate_answers: string;
          choose: number;
          userQuestionId?: number;
        }
      >(`${TABLES.STUDY_QUESTIONS} q`, [
        'q.id',
        'q.created',
        'q.subject_id',
        'q.answers',
        'q.question',
        'q.description',
        'q.alternate_answers',
        'q.choose',
        'uq.id userQuestionId',
        'MAX(q.updated, IIF(uq.created, uq.created, 0)) updated',
      ]).join(`${TABLES.STUDY_USERS_QUESTIONS} uq`, 'q.id = uq.question_id'),
    );
    this.createDeleteTrigger();
  }

  protected createDeleteTrigger() {
    DB.exec(`CREATE TRIGGER IF NOT EXISTS tg_${this.name}_delete
      AFTER DELETE ON ${this.name}
      FOR EACH ROW
      BEGIN
        UPDATE ${TABLES.STUDY_SUBJECTS} SET updated = current_timestamp
        WHERE id = old.subject_id;
      END
      `);
  }
}
export const questionsTable = new QuestionsTable();
