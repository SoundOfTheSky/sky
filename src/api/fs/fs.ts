import FileType from 'file-type';

import type { ApiHandler } from '..';
import fs from '../../services/fs';
import { getDataFromRequest, sendJSON } from '../../utils';
export default (async function (req, res, query) {
  if (!query.pathname.startsWith('/api/fs')) return;
  const path = query.pathname.length === 7 ? '/' : query.pathname.slice(7).replace(/%20/g, ' ');
  if (req.method === 'GET') {
    const dl = query.searchParams.get('dl') !== null;
    if (dl) {
      const file = await fs.readFile(path);
      const type = await FileType.fromBuffer(file);
      res
        .writeHead(200, {
          'content-length': file.byteLength,
          'content-type': type?.mime ?? 'text/plain',
        })
        .end(file);
    } else sendJSON(res, await fs.getInfo(path));
    return;
  }
  if (req.method === 'POST') {
    const move = query.searchParams.get('move');
    const copy = query.searchParams.get('copy');
    if (move) await fs.move(path, move);
    else if (copy) await fs.copy(path, copy);
    else await fs.write(path, await getDataFromRequest(req));
  } else if (req.method === 'DELETE') {
    await fs.delete(path);
    res.end();
  }
  res.end();
} as ApiHandler);
