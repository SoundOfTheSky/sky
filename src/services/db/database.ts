import { rm } from 'node:fs/promises'

import {
  FORMAT_NUMBER_RANGES_READABLE,
  SpeedCalculator,
  formatBytes,
  formatNumber,
  log,
} from '@softsky/utils'
import { file } from 'bun'
import { Database, constants } from 'bun:sqlite'

import { yandexDisk } from '@/services/fs'

// === DB initialization ===
log('[Loading] DB...')
const DBFileName = 'database.db'
const DBBackupName = 'backup.db'
export const database = await (async () => {
  let database
  try {
    database = new Database(DBFileName, {
      create: false,
      readwrite: true,
      safeIntegers: false,
      strict: true,
    })
  } catch {
    await rm(DBFileName, {
      force: true,
    })
    await rm(DBFileName + '-shm', {
      force: true,
    })
    await rm(DBFileName + '-wal', {
      force: true,
    })
    await loadBackupDB()
    database = new Database(DBFileName, {
      create: false,
      readwrite: true,
      safeIntegers: false,
      strict: true,
    })
  }
  return database
})()
database.fileControl(constants.SQLITE_FCNTL_PERSIST_WAL, 0)
// DB.exec('PRAGMA journal_mode = WAL');
// DB.exec('PRAGMA synchronous = NORMAL');
// DB.exec('PRAGMA wal_autocheckpoint = 1000');
// DB.exec('PRAGMA cache_size = 2000');
// DB.exec('PRAGMA busy_timeout = 5000');
// DB.exec('PRAGMA locking_mode = NORMAL');
database.exec('PRAGMA journal_mode = DELETE')
database.exec('PRAGMA foreign_keys = ON')
database.exec('PRAGMA auto_vacuum = INCREMENTAL')

export async function backupDB() {
  try {
    log('Started DB backup')
    database.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    database.exec(`VACUUM INTO '${DBBackupName}'`)
    log('Start upload')
    await yandexDisk.write(
      `backups/${Date.now()}.db`,
      file(DBBackupName).stream(),
    )
    log('Backup done!')
  } catch {
    console.error('Error while backing up db')
  }
}

export async function loadBackupDB(name?: string, restart?: boolean) {
  if (!name) {
    const info = await yandexDisk.getInfo('backups')
    const index = info.content
      ?.map((c, index_) => [Number.parseInt(c.name.slice(0, -3)), index_])
      .sort((a, b) => b[0]! - a[0]!)[0]?.[1]
    if (index === undefined) throw new Error("Can't find backup")
    name = info.content![index]!.name.slice(0, -3)
  }
  log('Downloading backup', name)
  const info = await yandexDisk.getInfo(`backups/${name}.db`)
  const response = await yandexDisk.read(`backups/${name}.db`)
  const dbfile = file(DBFileName).writer()
  const speedCalculator = new SpeedCalculator(info.size)
  const logInterval = setInterval(() => {
    console.log(
      `Downloading backup ${(speedCalculator.stats.percent * 100) | 0}% ${formatBytes(speedCalculator.sum)}/${formatBytes(info.size!)} ${formatBytes(speedCalculator.stats.speed)}/s ETA: ${formatNumber(speedCalculator.stats.eta, 1000, FORMAT_NUMBER_RANGES_READABLE)}`,
    )
  }, 5000)
  try {
    for await (const chunk of response as unknown as AsyncIterable<Uint8Array>) {
      speedCalculator.push(chunk.length)
      dbfile.write(chunk)
    }
    await dbfile.end()
  } finally {
    clearInterval(logInterval)
  }
  if (restart) {
    log('Restarting...')
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit()
  }
}

setInterval(() => void backupDB(), 86_400_000)
log('[Loading] DB ok!')
