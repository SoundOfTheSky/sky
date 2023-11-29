import { MatchedRoute, Server } from 'bun';
import { join, relative } from 'node:path';
import { ValidationError, formatTime, log } from '@/utils';
import { sessionGuard } from '@/services/session';

export type HTTPResponse = {
  headers: Headers;
  body?: BodyInit | null | undefined;
  /** @default 200 */
  status?: number;
  /** @default "OK" */
  statusText?: string;
};
export type HTTPHandler = (req: Request, res: HTTPResponse, route: MatchedRoute) => unknown;

export function sendJSON(res: HTTPResponse, data: unknown) {
  res.body = JSON.stringify(data);
  res.headers.set('Content-Type', 'application/json');
}
export function sendRedirect(res: HTTPResponse, location: string) {
  res.status = 302;
  res.headers.set('Location', location);
}

export class HTTPError extends Error {
  constructor(
    msg: string,
    public code: number,
    public body?: BodyInit | null | undefined,
  ) {
    super(msg);
  }
  override name = 'HTTPError';
}

export function setCookie(res: HTTPResponse, name: string, value: string) {
  const header = res.headers.get('Set-Cookie');
  res.headers.set(
    'Set-Cookie',
    `${header ? `${header},` : ''}${name}=${value}; Path=/; SameSite=none; Secure; HttpOnly`,
  );
  return res;
}

export function getCookies(req: Request) {
  const cookie = req.headers.get('cookie');
  if (!cookie) return {};
  return Object.fromEntries(cookie.split('; ').map((cookie) => cookie.split('='))) as Record<string, string>;
}

const router = new Bun.FileSystemRouter({
  style: 'nextjs',
  dir: join(import.meta.dir, '../routes'),
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
export async function handleHTTP(req: Request, server: Server): Promise<Response | undefined> {
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
