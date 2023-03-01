import { HTTPHandler } from '@/services/http';
import { getStaticFile } from '@/services/static';

export default (async function (req, res, router) {
  const file = await getStaticFile(router.pathname, req.headers.get('accept-encoding')?.includes('br'));
  if (!file) {
    res.status = 404;
    return;
  }
  res.body = file;
  res.headers.set('content-type', file.type ?? 'text/plain');
  res.headers.set('content-length', file.size.toString());
  if (file.name!.endsWith('.br')) res.headers.set('content-encoding', 'br');
} satisfies HTTPHandler);
