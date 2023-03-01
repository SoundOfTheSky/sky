import { imagesTable } from '../../services/images';
import { sendJSON } from '../../utils';
import type { ApiHandler } from '..';
export default (function (req, res, query) {
  if (query.pathname !== '/api/photos/md5' || req.method !== 'GET') return;
  const id = Number.parseInt(query.searchParams.get('id') ?? '');
  if (Number.isNaN(id)) {
    res.writeHead(400).end('No id supplied!');
    return;
  }
  sendJSON(res, imagesTable.get(id));
} as ApiHandler);
