import { albumsTable } from '../../services/images';
import { sendJSON, ValidationError } from '../../utils';
import type { ApiHandler } from '..';
export default (function (req, res, query) {
  if (query.pathname !== '/api/photos/album' || req.method !== 'GET') return;
  const id = Number.parseInt(query.searchParams.get('id') ?? '');
  if (Number.isNaN(id)) throw new ValidationError('Invalid id');
  const album = albumsTable.get(id);
  if (!album) {
    res.writeHead(404).end();
    return;
  }
  sendJSON(res, album);
} as ApiHandler);
