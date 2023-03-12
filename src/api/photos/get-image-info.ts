import { imagesTable } from '../../services/images';
import { sendJSON, ValidationError } from '../../utils';
import type { ApiHandler } from '..';
export default (function (req, res, query) {
  if (query.pathname !== '/api/photos/md5' || req.method !== 'GET') return;
  const id = Number.parseInt(query.searchParams.get('id') ?? '');
  if (Number.isNaN(id)) throw new ValidationError('Invalid id');
  sendJSON(res, imagesTable.get(id));
} as ApiHandler);
