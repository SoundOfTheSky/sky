import { HTTPError, HTTPHandler } from '@/services/http';
import { getStaticFileWithIndexFallback } from '@/services/static';

export default (async function (req, res, router) {
  const file = await getStaticFileWithIndexFallback(
    router.pathname,
    req.headers.get('accept-encoding')?.includes('br'),
  );
  if (!file) throw new HTTPError('Not found', 404);
  // Don't cache html files, otherswise cache for a week
  if (file.type.startsWith('text/html')) res.headers.set('cache-control', 'public, max-age=604800, immutable');
  res.body = file;
  res.headers.set('content-type', file.type ?? 'text/plain');
  res.headers.set('content-length', file.size.toString());
  if (file.name!.endsWith('.br')) res.headers.set('content-encoding', 'br');
} satisfies HTTPHandler);
