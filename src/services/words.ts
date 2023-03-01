import { DB, DBTable, TableDefaults, TableDTO } from '../db';

export type Word = TableDefaults & {
  word: string;
};
export class WordsTable extends DBTable<Word> {
  constructor(table: string) {
    super(table, {
      word: {
        type: 'TEXT',
        required: true,
        unique: true,
      },
    });
  }
  override create(data: TableDTO<Word>) {
    const a = this.convertFrom(DB.prepare(`SELECT id FROM ${this.name} WHERE word = ?`).get(data.word));
    if (a)
      return {
        changes: 0,
        lastInsertRowid: a.id,
      };
    return super.create(data);
  }
}
export const wordsTable = new WordsTable('words');
