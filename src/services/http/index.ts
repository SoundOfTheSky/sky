import { Server } from 'bun';
import { join, relative } from 'node:path';

import { HTTPHandler, HTTPResponse } from '@/services/http/types';
import { HTTPError } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { ValidationError, formatTime, log } from '@/utils';

const router = new Bun.FileSystemRouter({
  style: 'nextjs',
  dir: join(import.meta.dir, '../../routes'),
  origin: import.meta.dir,
});

log('[Loading] Handlers...');
const handlers = new Map(
  await Promise.all(
    Object.entries(router.routes).map(
      async ([key, val]) =>
        [key, ((await import(relative(import.meta.dir, val))) as { default: HTTPHandler }).default] as const,
    ),
  ),
);
log('[Loading] Handlers ok!');
export default async function handleHTTP(req: Request, server: Server): Promise<Response | undefined> {
  const url = req.url.slice(req.url.indexOf('/', 8));
  log(`[HTTP] ${req.method}: ${req.url}`);
  const time = Date.now();
  const res: HTTPResponse = {
    headers: new Headers(),
  };
  res.headers.set('cache-control', 'no-cache, no-store, max-age=0, must-revalidate');
  if (url === '/ws') {
    const payload = await sessionGuard({ req, res });
    if (
      server.upgrade(req, {
        headers: res.headers,
        data: { jwt: payload },
      })
    )
      return;
    return new Response('Upgrading to WebSocket failed', { status: 500 });
  }
  const routerResult = router.match(url)!;
  const handler = handlers.get(routerResult.name)!;
  try {
    await handler(req, res, routerResult);
  } catch (e) {
    if (e instanceof HTTPError) {
      res.status = e.code;
      res.body = e.body;
    } else if (e instanceof ValidationError) {
      res.status = 400;
      res.body = e.message;
    } else throw e;
  }
  log(`[HTTP END] ${req.method}: ${req.url} ${formatTime(Date.now() - time)}`);
  return new Response(res.body, res);
}
