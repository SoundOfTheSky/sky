import {
  convertFromArray,
  convertToArray,
  DB,
  DBTable,
  TableDefaults,
  defaultColumns,
  TableDTO,
  convertToBoolean,
  convertFromBoolean,
} from '@/services/db';
import { subjectsTable } from '@/services/study/subjects';
import { wordsTable } from '@/services/words';

export type Question = TableDefaults & {
  answers: string[];
  question: string;
  descriptionWordId: number;
  subjectId: number;
  alternateAnswers?: Record<string, string>;
  choose?: boolean;
};
export type QuestionDTO = TableDTO<Question>;
export class QuestionsTable extends DBTable<Question, QuestionDTO> {
  constructor(table: string) {
    super(table, {
      ...defaultColumns,
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
      descriptionWordId: {
        type: 'INTEGER',
        required: true,
        ref: {
          column: 'id',
          table: wordsTable.name,
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
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
