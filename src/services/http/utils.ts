import zlib from 'node:zlib'

import { TSchema } from '@sinclair/typebox'
import { TypeCheck } from '@sinclair/typebox/compiler'

import { BodyInit, HTTPResponse } from '@/services/http/types'
import { GetTypeFromCompiled } from '@/sky-shared/type-checker'

/** If thrown in handler will return response with code */
export class HTTPError extends Error {
  public constructor(
    message: string,
    public code: number,
    public body?: BodyInit | null | undefined,
  ) {
    super(message)
  }

  public override name = 'HTTPError'
}

/** Send any parsable data as json */
export function sendJSON(response: HTTPResponse, data: unknown) {
  response.body = JSON.stringify(data)
  response.headers.set('Content-Type', 'application/json')
}

export function sendCompressedJSON(response: HTTPResponse, data: unknown) {
  response.body = zlib.deflateSync(
    JSON.stringify(data),
  ) as unknown as Uint8Array
  response.headers.set('Content-Type', 'application/json')
  response.headers.set('Content-Encoding', 'deflate')
}

/** Send redirect to location */
export function sendRedirect(response: HTTPResponse, location: string) {
  response.status = 302
  response.headers.set('Location', location)
}

/** Set cookie. Can set multiple cookies. */
export function setCookie(response: HTTPResponse, name: string, value: string) {
  const header = response.headers.get('Set-Cookie')
  response.headers.set(
    'Set-Cookie',
    `${header ? `${header},` : ''}${name}=${value}; Path=/; SameSite=none; Secure; HttpOnly`,
  )
  return response
}

/** Gets cookies as Object */
export function getCookies(request: Request) {
  const cookie = request.headers.get('cookie')
  if (!cookie) return {}
  return Object.fromEntries(
    cookie.split('; ').map((cookie) => cookie.split('=')),
  ) as Record<string, string>
}

export async function getRequestBodyT<T extends TypeCheck<TSchema>>(
  request: Request,
  T: T,
): Promise<GetTypeFromCompiled<T>> {
  const body = (await request.json()) as unknown
  if (!T.Check(body))
    throw new HTTPError(
      'Validation error',
      400,
      JSON.stringify([...T.Errors(body)]),
    )
  return body as GetTypeFromCompiled<T>
}
