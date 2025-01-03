import { mkdir, rm } from 'node:fs/promises'
import Path from 'node:path'

import { ProgressLoggerTransform, log } from '@softsky/utils'
import { file, spawnSync } from 'bun'

import yandexDisk from '@/services/yandex-disk'

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
    (await getStaticFile(p, brotli))
    ?? (await getStaticFile(Path.join(p, INDEX), brotli))
    ?? (await getStaticFile(Path.join(STATIC_PATH, INDEX), brotli))
  )
}

export async function reloadStatic() {
  log('Downloading static files...')
  const staticFileName = 'static.zip'
  await rm(staticFileName, { force: true })
  const response = await yandexDisk.read(staticFileName)
  const zipFile = file(staticFileName).writer()
  for await (const chunk of response.body!.pipeThrough<Uint8Array>(
    new ProgressLoggerTransform(
      'Downloading static %p% %s/S %b/%s %lt %t',
      5,
      +response.headers.get('content-length')!,
    ),
  ) as unknown as AsyncIterable<Uint8Array>)
    zipFile.write(chunk)
  await zipFile.end()
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
