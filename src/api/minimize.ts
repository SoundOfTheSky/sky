import { readFile } from 'node:fs/promises';
import { fileTypeFromBuffer } from 'file-type';

import { authCheck, PERMISSIONS } from '../services/auth';
import { getDataFromRequest } from '../utils';
import { convertImage } from '../services/convert-image';
import type { ApiHandler } from '.';

export default (async function (req, res, query) {
  if (query.pathname !== '/api/minimize') return;
  if (!authCheck(req, res, [PERMISSIONS.ADMIN])) {
    if (!res.headersSent && res.writable) res.writeHead(401).end();
    return;
  }
  const data = req.method === 'GET' ? await readFile('test1.gif') : await getDataFromRequest(req);
  const type = await fileTypeFromBuffer(data);
  if (!type) {
    res.writeHead(400).end('Format is not recognized');
    return;
  }
  const optimized = await convertImage(data, type.ext, 'webp');
  const optimizedType = await fileTypeFromBuffer(optimized);
  res
    .writeHead(200, {
      'content-type': optimizedType?.mime,
      'content-length': optimized.length,
    })
    .end(optimized);
} as ApiHandler);
