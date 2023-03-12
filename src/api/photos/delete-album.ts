import { albumsTable } from '../../services/images';
import type { ApiHandler } from '..';
import { ValidationError } from '../../utils';
export default (function (req, res, query) {
  if (query.pathname !== '/api/photos/album' || req.method !== 'DELETE') return;
  const id = Number.parseInt(query.searchParams.get('id') ?? '');
  if (Number.isNaN(id)) throw new ValidationError('Invalid id');
  albumsTable.delete(id);
  res.end();
} as ApiHandler);
