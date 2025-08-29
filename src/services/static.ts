import { mkdir, rm } from 'node:fs/promises'
import Path from 'node:path'

import {
  FORMAT_NUMBER_RANGES_READABLE,
  SpeedCalculator,
  formatBytes,
  formatNumber,
  log,
} from '@softsky/utils'
import { file, spawnSync } from 'bun'

import { yandexDisk } from '@/services/fs'

const STATIC_PATH = 'static'
const INDEX = 'index.html'

export async function getStaticFile(path: string, brotli?: boolean) {
  let f = file(path)
  if (await f.exists()) return f
  if (brotli) {
    f = file(path + '.br')
    if (await f.exists()) return f
  }
}

export async function getStaticFileWithIndexFallback(
  path: string,
  brotli?: boolean,
) {
  const p = Path.join(STATIC_PATH, ...path.split(Path.sep))

  return (
    (await getStaticFile(p, brotli)) ??
    (await getStaticFile(Path.join(p, INDEX), brotli)) ??
    (await getStaticFile(Path.join(STATIC_PATH, INDEX), brotli))
  )
}

export async function reloadStatic() {
  log('Downloading static files...')
  const staticFileName = 'static.zip'
  await rm(staticFileName, { force: true })
  const info = await yandexDisk.getInfo(staticFileName)
  const response = await yandexDisk.read(staticFileName)
  const zipFile = file(staticFileName).writer()
  const speedCalculator = new SpeedCalculator(info.size)
  const logInterval = setInterval(() => {
    log(
      `Downloading static ${(speedCalculator.stats.percent * 100) | 0}% ${formatBytes(speedCalculator.sum)}/${formatBytes(info.size!)} ${formatBytes(speedCalculator.stats.speed)}/s ETA: ${formatNumber(speedCalculator.stats.eta, 1000, FORMAT_NUMBER_RANGES_READABLE)}`,
    )
  }, 5000)
  try {
    for await (const chunk of response as unknown as AsyncIterable<Uint8Array>) {
      speedCalculator.push(chunk.length)
      zipFile.write(chunk)
    }
    await zipFile.end()
  } finally {
    clearInterval(logInterval)
  }
  await rm(STATIC_PATH, { force: true })
  await mkdir(STATIC_PATH)
  log('Extracting static files...')
  spawnSync(['unzip', staticFileName, '-d', STATIC_PATH])
  await rm(staticFileName)
  log('Static files ready')
}
log('[Loading] Static...')
if (!(await file(Path.join(STATIC_PATH, INDEX)).exists())) await reloadStatic()
log('[Loading] Static ok!')
