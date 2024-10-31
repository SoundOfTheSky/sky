/* eslint-disable unused-imports/no-unused-vars */
import { Database, constants } from 'bun:sqlite';

import { log } from '@/sky-utils';

const DB = new Database('database.db', {
  create: false,
  readwrite: true,
  safeIntegers: false,
  strict: true,
});
DB.fileControl(constants.SQLITE_FCNTL_PERSIST_WAL, 0);
exec('PRAGMA journal_mode = DELETE');
exec('PRAGMA foreign_keys = ON');
exec('PRAGMA auto_vacuum = INCREMENTAL');

function exec(cmd: string) {
  try {
    log(cmd);
    DB.exec(cmd);
  } catch (e) {
    console.error('Error while executing query: ', cmd);
    throw e;
  }
}

function getTableSchema(name: string) {
  return DB.query<{ sql: string }, [string]>(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
  ).get(name)?.sql;
}

function getTableTriggers(name: string) {
  return DB.query<{ sql: string }, [string]>(
    `SELECT sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?`,
  )
    .all(name)
    .map((trigger) => trigger.sql);
}

function dropAllTriggers() {
  for (const { name } of DB.query<{ name: string }, []>(
    `SELECT name FROM sqlite_master WHERE type = 'trigger'`,
  ).all())
    exec(`DROP TRIGGER ${name}`);
}

function dropTable(name: string) {
  exec(`DROP TABLE ${name}`);
}

function renameTable(table: string, name: string) {
  exec(`ALTER TABLE ${table} RENAME TO ${name}`);
}

function renameColumn(table: string, column: string, name: string) {
  exec(`ALTER TABLE ${table} RENAME ${column} TO ${name}`);
}

function addColumn(table: string, name: string, definition: string) {
  exec(`ALTER TABLE ${table} ADD ${name} ${definition}`);
}

function dropColumn(table: string, column: string) {
  exec(`ALTER TABLE ${table} DROP ${column}`);
}

function changeColumn(
  table: string,
  column: string,
  name: string,
  definition: string,
) {
  const tmp = column + '_tmp';
  renameColumn(table, column, tmp);
  addColumn(table, name, definition);
  exec(`INSERT INTO ${table} (${name}) SELECT ${tmp} FROM ${table}`);
  dropColumn(table, tmp);
}

function editTableSchema(
  table: string,
  edit: (schema: string) => string,
  insertCols: Record<string, string> = {},
) {
  const tmp = table + '_tmp';
  exec('PRAGMA foreign_keys = OFF');
  const schema = getTableSchema(table);
  if (!schema) throw new Error('No such table');
  const triggers = getTableTriggers(table);
  exec(edit(schema.replace(table, tmp)));
  for (const col of DB.query<
    {
      name: string;
    },
    []
  >(`PRAGMA table_info(${tmp})`).all())
    if (!insertCols[col.name]) insertCols[col.name] = col.name;
  exec(
    `INSERT INTO "${tmp}"(${Object.keys(insertCols).join(', ')}) SELECT ${Object.values(insertCols).join(', ')} FROM "${table}"`,
  );
  dropTable(table);
  renameTable(tmp, table);
  for (const trigger of triggers) exec(trigger);
  exec('PRAGMA foreign_keys = ON');
}

function migration1() {
  // exec('BEGIN TRANSACTION');
  exec(`DELETE FROM users WHERE id = 2`);
  exec(`UPDATE users SET permissions = 'ADMIN'`);
  editTableSchema(
    `users`,
    (schema) =>
      schema.replace(
        `permissions TEXT NOT NULL,`,
        'permissions TEXT NOT NULL, password TEXT NOT NULL,',
      ),
    {
      password: "'BRUH'",
    },
  );
  editTableSchema(
    'users_answers',
    (schema) =>
      schema.replace(
        'created TEXT DEFAULT current_timestamp,',
        'created TEXT DEFAULT current_timestamp, updated TEXT DEFAULT current_timestamp,',
      ),
    {
      updated: 'created',
    },
  );
  editTableSchema('subjects', (schema) =>
    schema
      .replace(
        'FOREIGN KEY(srs_id) REFERENCES srs(id) ON DELETE CASCADE ON UPDATE CASCADE,',
        '',
      )
      .replace('srs_id INTEGER NOT NULL,', ''),
  );
  editTableSchema('users_themes', (schema) =>
    schema.replace(
      'need_unlock INTEGER NOT NULL,',
      'need_unlock INTEGER DEFAULT 1,',
    ),
  );
  dropTable('srs');
  dropTable('authenticators');
  renameTable('questions', 'study_questions');
  renameTable('subject_dependencies', 'study_subject_deps');
  renameTable('subjects', 'study_subjects');
  renameTable('themes', 'study_themes');
  renameTable('users_answers', 'study_answers');
  renameTable('users_questions', 'study_users_questions');
  renameTable('users_subjects', 'study_users_subjects');
  renameTable('users_themes', 'study_users_themes');
  dropAllTriggers();
  // exec('COMMIT');
}

migration1();
log('done!');
