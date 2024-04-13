/* eslint-disable @typescript-eslint/no-explicit-any */
import { file } from 'bun';
import { Database } from 'bun:sqlite';
import { rm } from 'node:fs/promises';

import yandexDisk from '@/services/yandex-disk';
import { ProgressLoggerTransform, camelToSnakeCase, log } from '@/utils';

// === Types ===
export type DBDataTypes = string | number | Uint8Array | null;
export type DBRow = Record<string, DBDataTypes>;
type TableColumn = {
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' | 'NULL';
  rename?: string;
  primaryKey?: boolean;
  autoincrement?: boolean;
  to?: (data: any) => DBDataTypes | undefined;
  from?: (data: DBDataTypes) => any;
  required?: boolean;
  default?: string | number;
  unique?: boolean;
  ref?: {
    table: string;
    column: string;
    onDelete?: 'SET NULL' | 'SET DEFAULT' | 'CASCADE';
    onUpdate?: 'SET NULL' | 'SET DEFAULT' | 'CASCADE';
  };
};
export type TableDefaults = {
  id: number;
  created: Date;
  updated: Date;
};
export type TableDTO<T> = Omit<T, keyof TableDefaults> & Partial<TableDefaults>;
export type UpdateTableDTO<T> = {
  [P in keyof T]?: T[P] | null | undefined;
};

// === DB initialization ===
log('[Loading] DB...');
const DBFileName = 'database.db';
export const DB = await (async () => {
  let db;
  try {
    db = new Database(DBFileName, {
      create: false,
      readwrite: true,
    });
  } catch (e) {
    await rm(DBFileName, {
      force: true,
    });
    await rm(DBFileName + '-shm', {
      force: true,
    });
    await rm(DBFileName + '-wal', {
      force: true,
    });
    await loadBackupDB();
    db = new Database(DBFileName, {
      create: true,
      readwrite: true,
    });
  }
  return db;
})();
DB.prepare('PRAGMA journal_mode=WAL').run();
DB.prepare('PRAGMA foreign_keys = ON').run();

export async function backupDB() {
  try {
    log('Started DB backup');
    DB.prepare('PRAGMA wal_checkpoint').run();
    DB.prepare('VACUUM').run();
    log('Start upload');
    await yandexDisk.write(`backups/${Date.now()}.db`, file(DBFileName).stream());
    log('Backup done!');
  } catch {
    console.error('Error while updating db');
  }
}
export async function loadBackupDB(name?: string, restart?: boolean) {
  if (!name) {
    const info = await yandexDisk.getInfo('backups');
    const index = info.content
      ?.map((c, i) => [Number.parseInt(c.name.slice(0, -3)), i])
      .sort((a, b) => b[0] - a[0])[0]?.[1];
    if (index === undefined) throw new Error("Can't find backup");
    name = info.content![index].name.slice(0, -3);
  }
  log('Downloading backup', name);
  const response = await yandexDisk.read(`backups/${name}.db`);
  const dbfile = file(DBFileName).writer();
  for await (const chunk of response.body!.pipeThrough<Uint8Array>(
    new ProgressLoggerTransform(
      'Downloading backup %p% %s/S %b/%s %lt %t',
      5,
      +response.headers.get('content-length')!,
    ),
  ) as unknown as AsyncIterable<Uint8Array>)
    dbfile.write(chunk);
  await dbfile.end();
  if (restart) {
    log('Restarting...');
    process.exit();
  }
}
setInterval(() => void backupDB(), 86_400_000);
log('[Loading] DB ok!');

// === DB Data Type convertations ===
export const convertToBoolean = (data: boolean | undefined | null) => (typeof data === 'boolean' ? +data : data);
export const convertFromBoolean = (data: DBDataTypes) => (typeof data === 'number' ? !!data : undefined);
export const convertToArray = (data: number[] | string[] | undefined | null) => data?.join('|');
export const convertFromArray = (data: DBDataTypes) => (typeof data === 'string' ? data.split('|') : undefined);
export const convertFromNumberArray = (data: DBDataTypes) =>
  typeof data === 'string' ? data.split('|').map((el) => +el) : undefined;
export const convertToDate = (d: Date | undefined | null) => {
  if (!d) return d;
  return `${d.getUTCFullYear()}-${`${d.getUTCMonth() + 1}`.padStart(2, '0')}-${d
    .getUTCDate()
    .toString()
    .padStart(2, '0')} ${d.getUTCHours().toString().padStart(2, '0')}:${d
    .getUTCMinutes()
    .toString()
    .padStart(2, '0')}:${d.getUTCSeconds().toString().padStart(2, '0')}`;
};
export const convertFromDate = (data: DBDataTypes) => (typeof data === 'string' ? new Date(data + 'Z') : undefined);

// === DB Table class ===
export const lastInsertRowIdQuery = DB.prepare<{ id: number }, []>('SELECT last_insert_rowid() AS id');
export const defaultColumns = {
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
export class DBTable<T, DTO = TableDTO<T>> {
  public name: string;
  public schema = new Map<string, TableColumn>();
  private columnNamesMap = new Map<string, string>();
  constructor(name: string, schema: Record<string, TableColumn>) {
    this.name = name;
    const schemaEntries = Object.entries(schema);
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
    this.registerUpdateTrigger();
  }

  private registerUpdateTrigger() {
    if (this.schema.get('updated')?.type !== 'TEXT') return;
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

  get(id: number | string, condition?: string) {
    let q = `SELECT * FROM ${this.name} WHERE id = ?`;
    if (condition) q += ' AND ' + condition;
    return this.convertFrom(DB.query(q).get(id));
  }
  getAll(condition?: string) {
    let q = `SELECT * FROM ${this.name}`;
    if (condition) q += ' WHERE ' + condition;
    return DB.query(q).all().map(this.convertFrom.bind(this)) as T[];
  }
  create(data: DTO) {
    const cols = this.convertTo(data);
    return DB.query(
      `INSERT INTO ${this.name} (${cols.map((x) => x[0]).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    ).run(...cols.map((x) => x[1]));
  }
  update(id: number | string, data: UpdateTableDTO<DTO>) {
    const cols = this.convertTo(data);
    if (cols.length === 0) return;
    return DB.query(`UPDATE ${this.name} SET ${cols.map((x) => x[0] + ' = ?').join(', ')} WHERE id = ?`).run(
      ...cols.map((x) => x[1]),
      id,
    );
  }
  delete(id: number | string) {
    return DB.query(`DELETE FROM ${this.name} WHERE id = ?`).run(id);
  }
  exists(id: number | string): boolean {
    return (
      DB.query<{ a: 0 | 1 }, [number | string]>(`SELECT COUNT(*) a FROM ${this.name} WHERE id = ?`).get(id)!.a !== 0
    );
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
  convertFrom(data?: unknown) {
    if (!data) return;
    return Object.fromEntries(
      Object.entries(data)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => {
          const columnName = this.columnNamesMap.get(k) ?? k;
          const column = this.schema.get(k);
          return [columnName, column?.from ? column.from(v as DBDataTypes) : v];
        }),
    ) as T;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// class SelectQuery<T, DTO> {
//   private query = '';
//   from: DBTable<T, DTO> | SelectQuery<T, DTO>;
//   _select = ['*'];
//   _where?: string;
//   _groupBy?: string[];
//   _sort?: Record<string, 1 | -1>;
//   _joins: { required: true | false; from: DBTable<T, DTO> | SelectQuery<T, DTO>; on: string[]; as?: string }[] = [];

//   constructor(columns: string[], from: DBTable<T, DTO> | SelectQuery<T, DTO>) {
//     this._select = columns;
//     this.from = from;
//   }

//   groupBy(columns: typeof this._groupBy) {
//     this._groupBy = columns;
//     return this;
//   }

//   sort(columns: typeof this._sort) {
//     this._sort = columns;
//     return this;
//   }

//   join(from: DBTable<T, DTO> | SelectQuery<T, DTO>, on: string[], as?: string) {
//     this._joins.push({ required: true, from, on, as });
//     return this;
//   }

//   leftJoin(from: DBTable<T, DTO> | SelectQuery<T, DTO>, on: string[], as?: string) {
//     this._joins.push({ required: false, from, on, as });
//     return this;
//   }

//   where(condition: typeof this._where) {
//     this._where = condition;
//     return this;
//   }

//   private static getFromString<T, DTO>(source: DBTable<T, DTO> | SelectQuery<T, DTO>) {
//     return source instanceof SelectQuery ? source.toString() : source.name;
//   }

//   update() {
//     this.query = `SELECT ${this._select.join(',')} FROM ${SelectQuery.getFromString(this.from)}`;
//     for (const { required, from, on, as } of this._joins) {
//       this.query += ` ${required ? 'JOIN' : 'LEFT JOIN'} ${SelectQuery.getFromString(from)}${
//         as ? ` ${as}` : ''
//       } ON ${on.join(' AND ')}`;
//     }
//     if (this._where) this.query += ` WHERE ${this._where}`;
//     if (this._groupBy) this.query += ` GROUP BY ${this._groupBy.join(',')}`;
//     if (this._sort)
//       this.query += ` ORDER BY ${Object.entries(this._sort)
//         .map(([k, v]) => `${k} ${v === 1 ? 'ASC' : 'DESC'}`)
//         .join(',')}`;
//   }

//   toString() {
//     return this.query;
//   }
// }

// DB.prepare(`UPDATE authenticators SET user_id = 1`).run();
// DB.prepare(`DELETE FROM users WHERE id != 1`).run();
