import type { ApiHandler } from '.';
import { getStaticFile } from '../services/static';

export default (async function (req, res, query) {
  const file = await getStaticFile(query.pathname, req.headers['accept-encoding']?.includes('br'));
  res.writeHead(200, {
    'content-type': file.info.mime ?? 'text/plain',
    'content-length': file.info.size,
    ...(file.info.path.endsWith('.br') && { 'content-encoding': 'br' }),
  });
  file.stream.pipe(res);
} as ApiHandler);
