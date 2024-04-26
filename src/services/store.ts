import { DB, DBTable, TableDefaults, UpdateTableDTO, DEFAULT_COLUMNS } from '@/services/db';

export type StoreData = {
  name: string;
  s?: string;
  n?: number;
  f?: number;
  b?: Buffer;
};
export class StoreTable extends DBTable<TableDefaults & StoreData> {
  constructor(table: string) {
    super(table, {
      ...DEFAULT_COLUMNS,
      name: {
        type: 'TEXT',
        required: true,
        unique: true,
      },
      s: {
        type: 'TEXT',
      },
      n: {
        type: 'INTEGER',
      },
      f: {
        type: 'REAL',
      },
      b: {
        type: 'BLOB',
      },
    });
  }
  queries = {
    getByName: DB.prepare(`SELECT * FROM ${this.name} WHERE name = ?`),
  };
  getValue(name: string): string | number | Buffer | undefined {
    const data = this.convertFrom(this.queries.getByName.get(name));
    if (data) return data.s ?? data.n ?? data.f ?? data.b;
    return undefined;
  }
  setValue(name: string, value?: string | number | Buffer) {
    const exists = this.convertFrom(this.queries.getByName.get(name));
    const newVal: UpdateTableDTO<StoreData> = {
      name,
      b: null,
      f: null,
      n: null,
      s: null,
    };
    if (typeof value === 'number') {
      if (value % 1 === 0) newVal.n = value;
      else newVal.f = value;
    } else if (typeof value === 'string') newVal.s = value;
    else if (Buffer.isBuffer(value)) newVal.b = value;

    if (exists) return this.update(exists.id, newVal);
    return this.create(newVal as StoreData);
  }
}
export const storeTable = new StoreTable('store');
