import { ValidationError } from '../../utils';
import type { ApiHandler } from '..';
import { imagesTable } from '../../services/images';

export default (async function (req, res, query) {
  if (query.pathname !== '/api/photos' || req.method !== 'DELETE') return;
  const id = Number.parseInt(query.searchParams.get('id') ?? '');
  if (Number.isNaN(id)) throw new ValidationError('Invalid id');
  await imagesTable.deleteImage(id);
  res.end();
} as ApiHandler);
