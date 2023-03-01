import { convertFromArray, convertToArray, DB, DBTable, TableDefaults } from '../../db';
import { wordsTable, WordsTable } from '../words';
import { subjectsTable, SubjectsTable } from './subjects';

export type Question = TableDefaults & {
  answers: string[];
  question: string;
  descriptionWordId: number;
  subjectId: number;
  alternateAnswers?: Record<string, string>;
  choose?: number;
};
export class QuestionsTable extends DBTable<Question> {
  private dependencyTables;
  constructor(
    table: string,
    dependencyTables: {
      wordsTable: WordsTable;
      subjectsTable: SubjectsTable;
    },
  ) {
    super(table, {
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
          table: dependencyTables.wordsTable.name,
        },
      },
      subjectId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: dependencyTables.subjectsTable.name,
          column: 'id',
          onDelete: 'CASCADE',
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
      },
    });
    this.dependencyTables = dependencyTables;
  }
  getBySubject(subjectId: number) {
    return DB.prepare(`SELECT * FROM ${this.name} WHERE subject_id = ?`)
      .all(subjectId)
      .map((el) => this.convertFrom(el)!);
  }
  getByQuestion(question: string) {
    return this.convertFrom(DB.prepare(`SELECT * FROM ${this.name} WHERE question = ?`).get(question));
  }
}
export const questionsTable = new QuestionsTable('questions', {
  wordsTable,
  subjectsTable,
});
