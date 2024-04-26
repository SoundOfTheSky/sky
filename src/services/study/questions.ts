import {
  convertFromArray,
  convertToArray,
  DB,
  DBTable,
  TableDefaults,
  DEFAULT_COLUMNS,
  TableDTO,
  convertToBoolean,
  convertFromBoolean,
} from '@/services/db';
import { subjectsTable } from '@/services/study/subjects';

export type Question = TableDefaults & {
  answers: string[];
  question: string;
  description: string;
  subjectId: number;
  alternateAnswers?: Record<string, string>;
  choose?: boolean;
};
export type QuestionDTO = TableDTO<Question>;
export class QuestionsTable extends DBTable<Question, QuestionDTO> {
  constructor(table: string) {
    super(table, {
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
          table: subjectsTable.name,
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
    });
  }
  queries = {
    getBySubject: DB.prepare(`SELECT * FROM ${this.name} WHERE subject_id = ?`),
  };
  getBySubject(subjectId: number) {
    return this.queries.getBySubject.all(subjectId).map((el) => this.convertFrom(el)!);
  }
}
export const questionsTable = new QuestionsTable('questions');
