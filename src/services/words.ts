import {
  DB,
  DBTable,
  TableDefaults,
  TableDTO,
  defaultColumns,
  lastInsertRowIdQuery,
  convertToDate,
} from '@/services/db';

export type Word = TableDefaults & {
  word: string;
};
export class WordsTable extends DBTable<Word> {
  constructor(table: string) {
    super(table, {
      ...defaultColumns,
      word: {
        type: 'TEXT',
        required: true,
        unique: true,
      },
    });
  }
  queries = {
    getByWord: DB.prepare(`SELECT id FROM ${this.name} WHERE word = ?`),
    getUpdated: DB.prepare<{ id: number; updated: number }, [string]>(
      `SELECT id, unixepoch(updated) updated
      FROM ${this.name}
      WHERE updated > ?`,
    ),
  };
  override create(data: TableDTO<Word>) {
    const a = this.convertFrom(this.queries.getByWord.get(data.word));
    if (a) return a.id;
    super.create(data);
    return lastInsertRowIdQuery.get()!.id;
  }

  getUpdated(updated: number) {
    return this.queries.getUpdated.values(convertToDate(new Date(updated * 1000))!) as [number, number][]
  }
}
export const wordsTable = new WordsTable('words');
