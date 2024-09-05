import { HTTPResponse } from '@/services/http/types';

/** If thrown in handler will return response with code */
export class HTTPError extends Error {
  public constructor(
    msg: string,
    public code: number,
    public body?: BodyInit | null | undefined,
  ) {
    super(msg);
  }

  public override name = 'HTTPError';
}

/** Send any parsable data as json */
export function sendJSON(res: HTTPResponse, data: unknown) {
  res.body = JSON.stringify(data);
  res.headers.set('Content-Type', 'application/json');
}

/** Send redirect to location */
export function sendRedirect(res: HTTPResponse, location: string) {
  res.status = 302;
  res.headers.set('Location', location);
}

/** Set cookie. Can set multiple cookies. */
export function setCookie(res: HTTPResponse, name: string, value: string) {
  const header = res.headers.get('Set-Cookie');
  res.headers.set(
    'Set-Cookie',
    `${header ? `${header},` : ''}${name}=${value}; Path=/; SameSite=none; Secure; HttpOnly`,
  );
  return res;
}

/** Gets cookies as Object */
export function getCookies(req: Request) {
  const cookie = req.headers.get('cookie');
  if (!cookie) return {};
  return Object.fromEntries(cookie.split('; ').map((cookie) => cookie.split('='))) as Record<string, string>;
}
