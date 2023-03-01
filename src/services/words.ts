import { DB, DBTable, TableDefaults, TableDTO, defaultColumns } from '@/services/db';

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
  };
  override create(data: TableDTO<Word>) {
    const a = this.convertFrom(this.queries.getByWord.get(data.word));
    if (a) return;
    return super.create(data);
  }
}
export const wordsTable = new WordsTable('words');
