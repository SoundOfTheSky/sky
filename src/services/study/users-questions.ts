import { convertFromArray, convertToArray, DB, DBTable, TableDefaults, UpdateTableDTO } from '../../db';
import { usersTable, UsersTable } from '../auth';
import { questionsTable, QuestionsTable } from './questions';

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
  getUserQuestion(userId: number, questionId: number) {
    const qs = this.convertFrom(
      DB.prepare(`SELECT * FROM ${this.name} WHERE user_id = ? AND question_id = ?`).get(userId, questionId),
    );
    if (!qs) return;
    const q = this.dependencyTables.questionsTable.get(questionId)!;
    return { ...q, note: qs.note, synonyms: qs.synonyms };
  }
}
export const usersQuestionsTable = new UsersQuestionsTable('users_questions', {
  questionsTable,
  usersTable,
});
