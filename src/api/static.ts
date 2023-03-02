import { basename, join, sep } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import FileType from 'file-type';
import { lookup as TypeLookUp } from 'mime-types';
import type { ApiHandler } from '.';

const STATIC_PATH = join('static');

type FileInfo = {
  mime?: string;
  buffer: Buffer;
  size: number;
  name: string;
};

/**
 * Get file buffer and mime type
 * @param path path to file
 * @returns buffer and mime type
 */
async function readFileInfo(path: string): Promise<FileInfo> {
  const stats = await stat(path);
  if (stats.isDirectory()) throw new Error('Trying to read a directory');
  const buffer = await readFile(path);
  const name = basename(path);
  let type = TypeLookUp(name) || undefined;
  if (!type) {
    const t = await FileType.fromBuffer(buffer);
    type = t!.mime;
  }
  return {
    mime: type,
    buffer,
    size: stats.size,
    name: basename(path),
  };
}

/**
 * Get file (cache or not)
 * @param path path to file
 * @returns file and mime type
 */
async function getFile(path: string) {
  const p = join(STATIC_PATH, ...path.split(sep));
  try {
    return await readFileInfo(p);
  } catch {
    try {
      return await readFileInfo(join(p, 'index.html'));
    } catch {
      return readFileInfo(join(STATIC_PATH, 'index.html'));
    }
  }
}
export default (async function (_req, res, query) {
  const fileInfo = await getFile(query.pathname);
  res
    .writeHead(200, {
      'Content-Type': fileInfo.mime ?? 'text/plain',
      'Content-Length': fileInfo.size,
    })
    .end(fileInfo.buffer);
} as ApiHandler);
