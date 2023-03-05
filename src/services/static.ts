import { join, sep } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import { log, noop } from '../utils';
import yandexDiskFS, { innerFS } from './fs';

const STATIC_PATH = 'static';

export async function getStaticFileData(path: string, brotli?: boolean) {
  const info = await innerFS.getInfo(path, true);
  if (info.isDir) throw new Error('Can not read directory');
  if (brotli) {
    try {
      const brotliInfo = await innerFS.getInfo(path + '.br', true);
      info.size = brotliInfo.size;
      info.path = brotliInfo.path;
    } catch {}
  }
  return {
    info,
    stream: innerFS.readStream(info.path),
  };
}

export async function getStaticFile(path: string, brotli?: boolean) {
  const p = join(STATIC_PATH, ...path.split(sep));
  try {
    return await getStaticFileData(p, brotli);
  } catch {
    try {
      return await getStaticFileData(join(p, 'index.html'), brotli);
    } catch {
      return getStaticFileData(join(STATIC_PATH, 'index.html'), brotli);
    }
  }
}

export async function reloadStatic() {
  log('Downloading static files...');
  await innerFS.delete(STATIC_PATH).catch(noop);
  async function r(from: string, to: string) {
    const fileInfo = await yandexDiskFS.getInfo(from);
    if (fileInfo.content) {
      await innerFS.mkDir(to);
      for (const file of fileInfo.content) await r(join(from, file.name), join(to, file.name));
    } else {
      const buffer = await yandexDiskFS.readFile(to);
      await innerFS.write(from, buffer);
      const compressed = brotliCompressSync(buffer);
      if (compressed.byteLength < buffer.byteLength) await innerFS.write(from + '.br', compressed);
    }
  }
  await r('static', STATIC_PATH);
  log('Static files downloaded');
}

try {
  await innerFS.getInfo(STATIC_PATH);
  log('Static OK');
} catch {
  await reloadStatic();
}
