import { TObject } from '@sinclair/typebox'
import { TypeCheck } from '@sinclair/typebox/compiler'
import { decode, EncoderStream } from 'cbor-x'

import { BodyInit, HTTPResponse } from '@/services/routing/types'

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

export async function getRequestBodyT(
  request: Request,
  T: TypeCheck<TObject>,
): Promise<unknown> {
  const body = (await decode(await request.bytes())) as unknown
  if (Array.isArray(body))
    for (let index = 0; index < body.length; index++)
      if (!T.Check(body))
        throw new HTTPError(
          'Validation error',
          400,
          JSON.stringify([...T.Errors(body)]),
        )
  if (!T.Check(body))
    throw new HTTPError(
      'Validation error',
      400,
      JSON.stringify([...T.Errors(body)]),
    )
  return body
}

export function sendBody(response: HTTPResponse, body: unknown) {
  response.body = new EncoderStream()
  ;(response.body as EncoderStream).write(body)
  response.headers.set('Content-Type', 'application/cbor')
}
