/* eslint-disable @typescript-eslint/no-explicit-any */
import { file } from 'bun';
import { Database, constants } from 'bun:sqlite';
import { rm } from 'node:fs/promises';

import yandexDisk from '@/services/yandex-disk';
import { ProgressLoggerTransform, log } from '@/sky-utils';

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
      safeIntegers: false,
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
      safeIntegers: false,
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
