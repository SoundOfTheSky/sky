import {
  convertFromArray,
  convertToArray,
  DB,
  DBTable,
  TableDefaults,
  UpdateTableDTO,
  defaultColumns,
  DBRow,
  convertToDate,
} from '@/services/db';
import { usersTable } from '@/services/session/user';
import { questionsTable } from '@/services/study/questions';
import { subjectsTable } from '@/services/study/subjects';

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
          onUpdate: 'CASCADE',
        },
      },
      questionId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: questionsTable.name,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
    });
  }
  queries = {
    getQuestion: DB.prepare<DBRow, [number, number | null]>(
      `SELECT 
        q.id,
        q.answers,
        q.question,
        q.description_word_id,
        q.subject_id,
        q.alternate_answers,
        q.choose,
        uq.note,
        uq.synonyms,
        IIF(uq.updated>q.updated, uq.updated, q.updated) updated,
        q.created
      FROM ${questionsTable.name} q
      LEFT OUTER JOIN ${this.name} uq ON uq.question_id = q.id
      WHERE q.id = ? AND (user_id = ? OR user_id IS NULL)`,
    ),
    getUpdated: DB.prepare<{ id: number; updated: number }, [number, string, string]>(
      `SELECT q.id, unixepoch(IIF(uq.updated>q.updated, uq.updated, q.updated)) updated
      FROM ${questionsTable.name} q
      LEFT JOIN ${this.name} uq ON uq.question_id = q.id
      WHERE (user_id = ? OR user_id IS NULL) AND (uq.updated > ? OR q.updated > ?)`,
    ),
    deleteByUserTheme: DB.prepare<unknown, [number, number]>(
      `DELETE FROM ${this.name} WHERE id IN (
        SELECT uq.id FROM ${this.name} uq
        JOIN ${questionsTable.name} q ON q.id == uq.question_id
        JOIN ${subjectsTable.name} s ON s.id == q.subject_id
        WHERE uq.user_id = ? AND s.theme_id = ?)`,
    ),
  };
  updateByQuestion(userId: number, questionId: number, data: UpdateTableDTO<UserQuestion>) {
    const cols = this.convertTo(data);
    if (cols.length === 0) return;
    return DB.prepare(
      `UPDATE ${this.name} SET ${cols.map((x) => x[0] + ' = ?').join(', ')} WHERE question_id = ? AND user_id = ?`,
    ).run(...cols.map((x) => x[1]), questionId, userId);
  }
  parseToDTO(x?: DBRow | null) {
    if (!x) return undefined;
    return {
      ...questionsTable.convertFrom(x),
      note: x['note'] as string,
      synonyms: convertFromArray(x['synonyms']) as string[],
    };
  }
  getQuestion(questionId: number, userId?: number) {
    const question = this.parseToDTO(this.queries.getQuestion.get(questionId, userId ?? null));
    if (!question) return;
    return question;
  }
  getUpdated(userId: number, updated: number) {
    const time = convertToDate(new Date(updated * 1000))!;
    return this.queries.getUpdated.values(userId, time, time) as [number, number][];
  }
}
export const usersQuestionsTable = new UsersQuestionsTable('users_questions');
