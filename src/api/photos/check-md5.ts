import { imagesTable } from '../../services/images';
import type { ApiHandler } from '..';
import { ValidationError } from '../../utils';
export default (function (req, res, query) {
  if (query.pathname !== '/api/photos/md5' || req.method !== 'GET') return;
  const md5 = query.searchParams.get('md5');
  if (!md5) throw new ValidationError('md5 is required');
  res.writeHead(imagesTable.checkExistsMD5(md5) ? 200 : 404).end();
} as ApiHandler);
