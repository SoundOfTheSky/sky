import { DEFAULT_COLUMNS, Table } from '@/services/db/table';
import { UpdateTableDTO } from '@/services/db/types';
import TABLES from '@/services/tables';
import { TableDefaults } from '@/sky-shared/db';

export type StoreData = {
  name: string;
  s?: string;
  n?: number;
  f?: number;
  b?: Buffer;
};
export class StoreTable extends Table<TableDefaults & StoreData> {
  protected $getByName = this.query.clone().where<{ name: string }>('name = $name').toDBQuery();

  public constructor() {
    super(TABLES.STORE, {
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

  public getValue(name: string): string | number | Buffer | undefined {
    const data = this.convertFrom(this.$getByName.get({ name }));
    if (data) return data.s ?? data.n ?? data.f ?? data.b;
    return undefined;
  }

  public setValue(name: string, value?: string | number | Buffer) {
    const exists = this.convertFrom(this.$getByName.get({ name }));
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
export const storeTable = new StoreTable();
