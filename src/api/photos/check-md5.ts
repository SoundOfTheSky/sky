import { imagesTable } from '../../services/images';
import type { ApiHandler } from '..';
export default (function (req, res, query) {
  if (query.pathname !== '/api/photos/md5' || req.method !== 'GET') return;
  const md5 = query.searchParams.get('md5');
  if (!md5) {
    res.writeHead(400).end('No md5 supplied!');
    return;
  }
  res.writeHead(imagesTable.checkExistsMD5(md5) ? 200 : 404).end();
} as ApiHandler);
