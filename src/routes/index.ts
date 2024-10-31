import { HTTPHandler } from '@/services/http/types';
import { HTTPError } from '@/services/http/utils';
import { getStaticFileWithIndexFallback } from '@/services/static';

export default (async function (req, res, router) {
  if (router.pathname.startsWith('/api/'))
    throw new HTTPError('Not found', 404);
  const file = await getStaticFileWithIndexFallback(
    router.pathname,
    req.headers.get('accept-encoding')?.includes('br'),
  );
  if (!file) throw new HTTPError('Not found', 404);
  // Static is unchangeable, cache for a year (max val)
  if (router.pathname.startsWith('/static/'))
    res.headers.set('cache-control', 'public, max-age=31536000, immutable');
  // Don't cache html files, otherswise cache for a week
  else if (!file.type.startsWith('text/html'))
    res.headers.set('cache-control', 'public, max-age=604800, immutable');
  res.body = file;
  res.headers.set('content-type', file.type);
  res.headers.set('content-length', file.size.toString());
  if (file.name!.endsWith('.br')) res.headers.set('content-encoding', 'br');
} satisfies HTTPHandler);
