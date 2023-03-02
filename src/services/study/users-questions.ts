import type { DBDataTypes } from 'better-sqlite3';
import { convertFromArray, convertToArray, DB, DBTable, TableDefaults, UpdateTableDTO } from '../../db';
import { usersTable, UsersTable } from '../auth';
import { Question, questionsTable, QuestionsTable } from './questions';

export type UserQuestion = TableDefaults & {
  note?: string | undefined;
  synonyms?: string[] | undefined;
  userId: number;
  questionId: number;
};
export class UsersQuestionsTable extends DBTable<UserQuestion> {
  private dependencyTables;
  constructor(
    table: string,
    dependencyTables: {
      usersTable: UsersTable;
      questionsTable: QuestionsTable;
    },
  ) {
    super(table, {
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
          table: dependencyTables.usersTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
      questionId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: dependencyTables.questionsTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
    });
    this.dependencyTables = dependencyTables;
  }
  updateByQuestion(userId: number, questionId: number, data: UpdateTableDTO<UserQuestion>) {
    const cols = this.convertTo(data);
    if (cols.length === 0) return;
    return DB.prepare(
      `UPDATE ${this.name} SET ${cols.map((x) => x[0] + ' = ?').join(', ')} WHERE question_id = ? AND user_id = ?`,
    ).run(...cols.map((x) => x[1]), questionId, userId);
  }
  getQuestion(questionId: number, userId?: number) {
    const question = this.dependencyTables.questionsTable.convertFrom(
      this.convertFrom(
        DB.prepare(
          `SELECT q.id, q.answers, q.question, q.description_word_id, q.subject_id, q.alternate_answers, q.choose, uq.note, uq.synonyms
          FROM ${this.dependencyTables.questionsTable.name} q
          LEFT OUTER JOIN ${this.name} uq ON uq.question_id = q.id
          WHERE q.id = ? AND (user_id = ? OR user_id IS NULL)`,
        ).get(questionId, userId),
      ) as unknown as Record<string, DBDataTypes>,
    ) as Omit<Question & UserQuestion, 'userId' | 'questionId' | 'created' | 'updated'> | undefined;
    if (!question) return;
    return question;
  }
}
export const usersQuestionsTable = new UsersQuestionsTable('users_questions', {
  questionsTable,
  usersTable,
});
