import {
  convertFromArray,
  convertToArray,
  DB,
  DBTable,
  TableDefaults,
  UpdateTableDTO,
  defaultColumns,
  DBRow,
} from '@/services/db';
import { usersTable } from '@/services/session/user';
import { Question, questionsTable } from '@/services/study/questions';

export type UserQuestion = TableDefaults & {
  note?: string | undefined;
  synonyms?: string[] | undefined;
  userId: number;
  questionId: number;
};
export class UsersQuestionsTable extends DBTable<UserQuestion> {
  constructor(table: string) {
    super(table, {
      ...defaultColumns,
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
          table: usersTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
      questionId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: questionsTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
    });
  }
  queries = {
    getQuestion: DB.prepare<DBRow, [number, number | null]>(
      `SELECT q.id, q.answers, q.question, q.description_word_id, q.subject_id, q.alternate_answers, q.choose, uq.note, uq.synonyms
      FROM ${questionsTable.name} q
      LEFT OUTER JOIN ${this.name} uq ON uq.question_id = q.id
      WHERE q.id = ? AND (user_id = ? OR user_id IS NULL)`,
    ),
  };
  updateByQuestion(userId: number, questionId: number, data: UpdateTableDTO<UserQuestion>) {
    const cols = this.convertTo(data);
    if (cols.length === 0) return;
    return DB.prepare(
      `UPDATE ${this.name} SET ${cols.map((x) => x[0] + ' = ?').join(', ')} WHERE question_id = ? AND user_id = ?`,
    ).run(...cols.map((x) => x[1]), questionId, userId);
  }
  getQuestion(questionId: number, userId?: number) {
    const question = questionsTable.convertFrom(
      this.convertFrom(this.queries.getQuestion.get(questionId, userId ?? null)),
    ) as Omit<Question & UserQuestion, 'userId' | 'questionId' | 'created' | 'updated'> | undefined;
    if (!question) return;
    return question;
  }
}
export const usersQuestionsTable = new UsersQuestionsTable('users_questions');
