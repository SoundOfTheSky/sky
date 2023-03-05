/* eslint-disable @typescript-eslint/no-explicit-any */
import { createReadStream, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import Database, { DBDataTypes, RunResult } from 'better-sqlite3';
import { innerFS, yandexDiskFS } from './services/fs';
import { camelToSnakeCase, log } from './utils';

const DBFileName = 'database.db';
if (!existsSync(DBFileName)) await loadBackupDB();
export const DB = new Database(DBFileName);

// DB.pragma('ignore_check_constraints = 1');
// DB.pragma('foreign_keys = 0');
// for (const tableName of DB.prepare(
//   `SELECT * FROM sqlite_master
//     WHERE type = 'table' AND name NOT IN ('users', 'authenticators', 'sqlite_sequence');`,
// )
//   .all()
//   .map((el) => el['name'] as string))
//   DB.prepare(`DROP TABLE ${tableName}`).run();
// DB.prepare(`VACUUM`).run();
// DB.pragma('ignore_check_constraints = 0');
// DB.pragma('foreign_keys = 1');
// DB.prepare(`UPDATE authenticators SET user_id = 1 WHERE user_id = 53`).run();
// DB.prepare(`DELETE FROM users WHERE id != 1`).run();

export type TableDTO<T> = Omit<T, 'id' | 'created' | 'updated'>;
export type UpdateTableDTO<T> = {
  [P in keyof T]?: T[P] | null | undefined;
};
export type TableDefaults = {
  id: number;
  created: string;
  updated: string;
};
type TableColumn = {
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' | 'NULL';
  rename?: string;
  primaryKey?: boolean;
  autoincrement?: boolean;
  to?: (data: any) => DBDataTypes | undefined;
  from?: (data: DBDataTypes) => any;
  required?: boolean;
  default?: 'current_timestamp' | string | number;
  unique?: boolean;
  ref?: {
    table: string;
    column: string;
    onDelete?: 'SET NULL' | 'SET DEFAULT' | 'CASCADE';
    onUpdate?: 'SET NULL' | 'SET DEFAULT' | 'CASCADE';
  };
};
export class DBTable<T, DTO = TableDTO<T>> {
  public name: string;
  public schema = new Map<string, TableColumn>();
  private columnNamesMap = new Map<string, string>();
  constructor(name: string, schema: Record<string, TableColumn>) {
    this.name = name;
    const schemaEntries = Object.entries(schema);
    function createFieldIfNotExists(name: string, schema: TableColumn) {
      if (schemaEntries.every(([k, v]) => v.rename !== name && k !== name)) schemaEntries.unshift([name, schema]);
    }
    createFieldIfNotExists('created', {
      type: 'TEXT',
      default: 'current_timestamp',
    });
    createFieldIfNotExists('updated', {
      type: 'TEXT',
      default: 'current_timestamp',
    });
    createFieldIfNotExists('id', {
      type: 'INTEGER',
      autoincrement: true,
      primaryKey: true,
    });
    for (const [k, v] of schemaEntries) {
      const tableColumnName = v.rename ?? camelToSnakeCase(k);
      this.schema.set(tableColumnName, v);
      this.columnNamesMap.set(k, tableColumnName);
      this.columnNamesMap.set(tableColumnName, k);
    }
    this.initializeTable();
  }

  private initializeTable() {
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
    DB.prepare(
      `CREATE TRIGGER IF NOT EXISTS tg_${this.name}_update
        AFTER UPDATE
        ON ${this.name} FOR EACH ROW
        BEGIN
          UPDATE ${this.name} SET updated = current_timestamp
        WHERE id = old.id;
      END`,
    ).run();
  }

  get(id: number | string, condition?: string): T | undefined {
    let q = `SELECT * FROM ${this.name} WHERE id = ?`;
    if (condition) q += ' AND ' + condition;
    return this.convertFrom(DB.prepare(q).get(id));
  }
  getAll(condition?: string): T[] {
    let q = `SELECT * FROM ${this.name}`;
    if (condition) q += ' WHERE ' + condition;
    return DB.prepare(q).all().map(this.convertFrom.bind(this)) as T[];
  }
  create(data: DTO): RunResult {
    const cols = this.convertTo(data);
    return DB.prepare(
      `INSERT INTO ${this.name} (${cols.map((x) => x[0]).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    ).run(cols.map((x) => x[1]));
  }
  update(id: number | string, data: UpdateTableDTO<DTO>) {
    const cols = this.convertTo(data);
    if (cols.length === 0) return;
    return DB.prepare(`UPDATE ${this.name} SET ${cols.map((x) => x[0] + ' = ?').join(', ')} WHERE id = ?`).run(
      ...cols.map((x) => x[1]),
      id,
    );
  }
  delete(id: number | string): RunResult {
    return DB.prepare(`DELETE FROM ${this.name} WHERE id = ?`).run(id);
  }
  exists(id: number | string): boolean {
    return DB.prepare(`SELECT COUNT(1) FROM ${this.name} WHERE id = ?`).get(id)!['COUNT(1)'] !== 0;
  }

  convertTo(data: UpdateTableDTO<DTO>) {
    return Object.entries(data)
      .map(([k, v]) => {
        const tableColumnName = this.columnNamesMap.get(k);
        if (!tableColumnName) return;
        const column = this.schema.get(tableColumnName)!;
        if (column.to) v = column.to(v);
        if (v === undefined) return;
        if (!column.required && v === '') v = null;
        return [tableColumnName, v];
      })
      .filter(Boolean) as [string, DBDataTypes][];
  }
  convertFrom(data?: Record<string, DBDataTypes>) {
    if (!data) return;
    return Object.fromEntries(
      Object.entries(data)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => {
          const columnName = this.columnNamesMap.get(k) ?? k;
          const column = this.schema.get(k);
          return [columnName, column?.from ? column.from(v) : v];
        }),
    ) as T;
  }
}
export const convertToBoolean = (data: boolean | undefined | null) => (typeof data === 'boolean' ? +data : data);
export const convertFromBoolean = (data: DBDataTypes) => (typeof data === 'number' ? !!data : data);
export const convertToArray = (data: number[] | undefined | null) => data?.join('|');
export const convertFromArray = (data: DBDataTypes) =>
  typeof data === 'string' ? data.split('|').filter(Boolean) : data;
export const convertFromNumberArray = (data: DBDataTypes) =>
  typeof data === 'string' ? data.split('|').map((el) => +el) : data;

export async function backupDB() {
  log('Started DB backup');
  await DB.backup('backup.db');
  log('Uploading backup...');
  await yandexDiskFS.write(`backups/${Date.now()}.db`, createReadStream('backup.db'));
  unlinkSync('backup.db');
  log('Backup done!');
}
export async function loadBackupDB(name?: string, restart?: boolean) {
  log('Downloading backup', name);
  if (!name) {
    const info = await yandexDiskFS.getInfo('backups');
    const index = info.content
      ?.map((c, i) => [Number.parseInt(c.name.slice(0, -3)), i])
      .sort((a, b) => b[0]! - a[0]!)[0]?.[1];
    if (index === undefined) throw new Error("Can't find backup");
    name = info.content![index]!.name.slice(0, -3);
  }
  await innerFS.write(DBFileName, yandexDiskFS.readStream(`backups/${name}.db`));
  if (restart) {
    log('Restarting...');
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit();
  }
}
setTimeout(() => void backupDB(), 86_400_000);
