/* eslint-disable @typescript-eslint/no-explicit-any */
import { file } from 'bun';
import { Database, constants } from 'bun:sqlite';
import { rm } from 'node:fs/promises';

import yandexDisk from '@/services/yandex-disk';
import { Changes, DBDataTypes, DBRow, TableDTO } from '@/sky-shared/db';
import { ProgressLoggerTransform, camelToSnakeCase, log } from '@/sky-utils';

// === Types ===
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
export type UpdateTableDTO<T> = {
  [P in keyof T]?: T[P] | null | undefined;
};

// === DB initialization ===
log('[Loading] DB...');
const DBFileName = 'database.db';
const DBBackupName = 'backup.db';
export const DB = await (async () => {
  let db;
  try {
    db = new Database(DBFileName, {
      create: false,
      readwrite: true,
      safeInteger: true,
      strict: true,
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
      safeInteger: true,
      strict: true,
    });
  }
  return db;
})();
DB.fileControl(constants.SQLITE_FCNTL_PERSIST_WAL, 0);
// DB.exec('PRAGMA journal_mode = WAL');
// DB.exec('PRAGMA synchronous = NORMAL');
// DB.exec('PRAGMA wal_autocheckpoint = 1000');
// DB.exec('PRAGMA cache_size = 2000');
// DB.exec('PRAGMA busy_timeout = 5000');
// DB.exec('PRAGMA locking_mode = NORMAL');
DB.exec('PRAGMA journal_mode = DELETE');
DB.exec('PRAGMA foreign_keys = ON');
DB.exec('PRAGMA auto_vacuum = INCREMENTAL');

export async function backupDB() {
  try {
    log('Started DB backup');
    DB.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    DB.exec(`VACUUM INTO '${DBBackupName}'`);
    log('Start upload');
    await yandexDisk.write(`backups/${Date.now()}.db`, file(DBBackupName).stream());
    log('Backup done!');
  } catch {
    console.error('Error while backing up db');
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
export class DBTable<T, DTO = TableDTO<T>> {
  public name: string;
  public schema = new Map<string, TableColumn>();
  protected columnNamesMap = new Map<string, string>();
  protected $getById;
  protected $deleteById;
  protected $getUpdated;

  public constructor(name: string, schema: Record<string, TableColumn>) {
    this.name = name;
    const schemaEntries = Object.entries(schema);
    for (const [k, v] of schemaEntries) {
      const tableColumnName = v.rename ?? camelToSnakeCase(k);
      this.schema.set(tableColumnName, v);
      this.columnNamesMap.set(k, tableColumnName);
      this.columnNamesMap.set(tableColumnName, k);
    }
    this.initializeTable();
    this.$getById = DB.prepare<DBRow, [number | string]>(`SELECT * FROM ${this.name} WHERE id = ?`);
    this.$deleteById = DB.prepare<undefined, [number | string]>(`DELETE FROM ${this.name} WHERE id = ?`);
    this.$getUpdated = DB.prepare<{ id: number | string; u: number }, [string]>(
      `SELECT id, unixepoch(updated) u FROM ${this.name} WHERE updated > ? ORDER BY u ASC`,
    );
  }

  public getById(id: number | string) {
    return this.convertFrom(this.$getById.get(id));
  }

  public getUpdated(time: Date) {
    return this.$getUpdated.values(convertToDate(time)!) as [number, number][];
  }

  public create(data: DTO): Changes {
    const cols = this.convertTo(data);
    return DB.query(
      `INSERT INTO ${this.name} (${cols.map((x) => x[0]).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    ).run(...cols.map((x) => x[1]));
  }

  public update(id: number | string, data: UpdateTableDTO<DTO>): Changes {
    const cols = this.convertTo(data);
    if (cols.length === 0) throw new Error('No fields to update');
    return DB.query(`UPDATE ${this.name} SET ${cols.map((x) => x[0] + ' = ?').join(', ')} WHERE id = ?`).run(
      ...cols.map((x) => x[1]),
      id,
    );
  }

  public deleteById(id: number): Changes {
    return this.$deleteById.run(id);
  }

  public convertTo(data: UpdateTableDTO<DTO>) {
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

  public convertFrom(data?: unknown) {
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
export class DBTableWithUser<T, DTO = TableDTO<T>> extends DBTable<T, DTO> {
  protected $getByIdUser = DB.prepare<DBRow, [number, number]>(
    `SELECT * FROM ${this.name} WHERE id = ? AND user_id = ?`,
  );
  protected $deleteByIdUser = DB.prepare<undefined, [number, number]>(
    `DELETE FROM ${this.name} WHERE id = ? AND user_id = ?`,
  );
  protected $getUpdatedUser = DB.prepare<{ id: number | string; u: number }, [string, number]>(
    `SELECT id, unixepoch(updated) u FROM ${this.name} WHERE updated > ? AND user_id = ? ORDER BY u ASC`,
  );

  public getByIdUser(id: number, userId: number) {
    return this.convertFrom(this.$getByIdUser.get(id, userId));
  }

  public deleteByIdUser(id: number, userId: number) {
    return this.$deleteByIdUser.run(id, userId) as Changes;
  }

  public getUpdatedByUser(time: Date, userId: number) {
    return this.$getUpdatedUser.values(convertToDate(time)!, userId) as [number, number][];
  }

  public updateByUser(id: number | string, data: UpdateTableDTO<DTO>, userId: number): Changes {
    const cols = this.convertTo(data);
    if (cols.length === 0) throw new Error('No fields to update');
    return DB.query(
      `UPDATE ${this.name} SET ${cols.map((x) => x[0] + ' = ?').join(', ')} WHERE id = ? AND user_id = ?`,
    ).run(...cols.map((x) => x[1]), id, userId);
  }
}
