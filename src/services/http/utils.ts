import zlib from 'node:zlib';

import { TSchema } from '@sinclair/typebox';
import { TypeCheck } from '@sinclair/typebox/compiler';

import { BodyInit, HTTPResponse } from '@/services/http/types';
import { GetTypeFromCompiled } from '@/sky-shared/type-checker';

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

export function sendCompressedJSON(res: HTTPResponse, data: unknown) {
  res.body = zlib.deflateSync(JSON.stringify(data));
  res.headers.set('Content-Type', 'application/json');
  res.headers.set('Content-Encoding', 'deflate');
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

export async function getRequestBodyT<T extends TypeCheck<TSchema>>(
  req: Request,
  T: T,
): Promise<GetTypeFromCompiled<T>> {
  const body = await req.json();
  if (!T.Check(body)) throw new HTTPError('Validation error', 400, JSON.stringify([...T.Errors(body)]));
  return body as GetTypeFromCompiled<T>;
}
