/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { convertFromDate, convertToDate } from '@/services/db/convetrations';
import { DB } from '@/services/db/db';
import { Query } from '@/services/db/query';
import { DBDataType, DBRow, TableColumn, TableDTO, UpdateTableDTO } from '@/services/db/types';
import { Changes, TableDefaults } from '@/sky-shared/db';
import { camelToSnakeCase } from '@/sky-utils';

export const DEFAULT_COLUMNS = {
  id: {
    type: 'INTEGER',
    autoincrement: true,
    primaryKey: true,
  },
  created: {
    type: 'TEXT',
    default: 'current_timestamp',
    from: convertFromDate,
    to: convertToDate,
  },
  updated: {
    type: 'TEXT',
    default: 'current_timestamp',
    from: convertFromDate,
    to: convertToDate,
  },
} as const;

export class Table<
  OUTPUT extends TableDefaults = TableDefaults,
  INPUT extends object = TableDTO<OUTPUT>,
  QUERY extends Query<TableDefaults> = Query<TableDefaults>,
> {
  public name: string;
  public schema = new Map<string, TableColumn>();
  public query: QUERY;
  protected $getById;
  protected $deleteById;
  protected columnTo = new Map<string, string>();
  protected columnFrom = new Map<string, string>();

  public constructor(name: string, schema: Record<string, TableColumn>, query?: QUERY) {
    this.name = name;
    const schemaEntries = Object.entries(schema);
    for (const [k, v] of schemaEntries) {
      const tableColumnName = v.rename ?? camelToSnakeCase(k);
      this.schema.set(tableColumnName, v);
      this.columnTo.set(k, tableColumnName);
      this.columnFrom.set(tableColumnName, k);
    }
    this.initializeTable();
    this.query = query ?? (new Query(this.name) as QUERY);
    this.$getById = this.query.clone().where<{ id: number | string }>('id = $id').toDBQuery();
    this.$deleteById = DB.prepare<undefined, { id: number | string }>(`DELETE FROM ${this.name} WHERE id = $id`);
  }

  public getById(id: string | number): OUTPUT | undefined {
    return this.convertFrom(this.$getById.get({ id }));
  }

  public deleteById(id: string | number): Changes {
    return this.$deleteById.run({ id });
  }

  public create(data: INPUT): Changes {
    const cols = this.convertTo(data);
    return DB.query(
      `INSERT INTO ${this.name} (${cols.map((x) => x[0]).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    ).run(...cols.map((x) => x[1]));
  }

  public update(id: number | string, data: UpdateTableDTO<INPUT>): Changes {
    const cols = this.convertTo(data);
    if (cols.length === 0) throw new Error('No fields to update');
    return DB.query(`UPDATE ${this.name} SET ${cols.map((x) => x[0] + ' = ?').join(', ')} WHERE id = ?`).run(
      ...cols.map((x) => x[1]),
      id,
    );
  }

  public convertTo(data: UpdateTableDTO<INPUT>) {
    return Object.entries(data)
      .map(([k, v]) => {
        const tableColumnName = this.columnTo.get(k);
        if (!tableColumnName) return;
        const column = this.schema.get(tableColumnName)!;
        if (column.to) v = column.to(v);
        if (v === undefined) return;
        if (!column.required && v === '') v = null;
        return [tableColumnName, v];
      })
      .filter(Boolean) as [string, DBDataType][];
  }

  public convertFrom(data?: DBRow | null) {
    if (!data) return;
    return Object.fromEntries(
      Object.entries(data)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => {
          const column = this.schema.get(k);
          return [this.columnFrom.get(k) ?? k, column?.from ? column.from(v) : v];
        }),
    ) as OUTPUT;
  }

  public convertFromMany(data: DBRow[]) {
    return data.map((x) => this.convertFrom(x)!);
  }

  protected initializeTable() {
    const append: string[] = [];
    DB.prepare(
      `CREATE TABLE IF NOT EXISTS ${this.name} (
        ${[
          [...this.schema.entries()].map(([name, options]) => {
            let q = `${name} ${options.type}`;
            if (options.required) q += ' NOT NULL';
            else if (options.default)
              q += ` DEFAULT ${
                typeof options.default === 'string' && options.default !== 'current_timestamp'
                  ? `"${options.default}"`
                  : options.default
              }`;
            if (options.unique) q += ' UNIQUE';
            if (options.primaryKey) q += ' PRIMARY KEY';
            if (options.autoincrement) q += ' AUTOINCREMENT';
            if (options.ref)
              append.push(
                `FOREIGN KEY(${name}) REFERENCES ${options.ref.table}(${options.ref.column})${
                  options.ref.onDelete ? ' ON DELETE ' + options.ref.onDelete : ''
                }${options.ref.onUpdate ? ' ON UPDATE ' + options.ref.onUpdate : ''}`,
              );
            return q;
          }),
          ...append,
        ].join(',')})`,
    ).run();
    this.registerUpdateTrigger();
  }

  protected registerUpdateTrigger() {
    if (this.schema.get('updated')?.type !== 'TEXT') return;
    DB.exec(
      `CREATE TRIGGER IF NOT EXISTS tg_${this.name}_update
      AFTER UPDATE ON ${this.name} FOR EACH ROW
      BEGIN
        UPDATE ${this.name} SET updated = current_timestamp
        WHERE id = old.id;
      END`,
    );
  }
}
export class TableWithUser<
  OUTPUT extends TableDefaults & { userId: number } = TableDefaults & { userId: number },
  INPUT extends object = TableDTO<OUTPUT>,
  QUERY extends Query<TableDefaults & { user_id: number }> = Query<TableDefaults & { user_id: number }>,
> extends Table<OUTPUT, INPUT, QUERY> {
  protected $getByIdUser = this.query
    .clone()
    .where<{ id: string | number; userId: number }>('id = $id AND user_id = $userId')
    .toDBQuery();

  protected $deleteByIdUser = DB.prepare<undefined, { id: number | string; userId: number }>(
    `DELETE FROM ${this.name} WHERE id = $id AND user_id = $userId`,
  );

  public updateByUser(id: number | string, data: UpdateTableDTO<INPUT>): Changes {
    const cols = this.convertTo(data);
    const userId = (data as unknown as { user_id: number }).user_id;
    delete (data as { user_id?: number }).user_id;
    if (cols.length === 0) throw new Error('No fields to update');
    return DB.query(
      `UPDATE ${this.name} SET ${cols.map((x) => x[0] + ' = ?').join(', ')} WHERE id = ? AND user_id = ?`,
    ).run(...cols.map((x) => x[1]), id, userId);
  }

  public getByIdUser(id: string | number, userId: number): OUTPUT | undefined {
    return this.convertFrom(this.$getByIdUser.get({ id, userId }));
  }

  public deleteByIdUser(id: string | number, userId: number): Changes {
    return this.$deleteByIdUser.run({ id, userId });
  }
}
