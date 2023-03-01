import { albumsTable } from '../../services/images';
import type { ApiHandler } from '..';
export default (function (req, res, query) {
  if (query.pathname !== '/api/photos/album' || req.method !== 'DELETE') return;
  const id = Number.parseInt(query.searchParams.get('id') ?? '');
  if (Number.isNaN(id)) {
    res.writeHead(400).end('No id supplied!');
    return;
  }
  albumsTable.delete(id);
  res.end();
} as ApiHandler);
