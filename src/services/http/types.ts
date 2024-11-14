import { MatchedRoute } from 'bun'

export type BodyInit =
  | ArrayBuffer
  | AsyncIterable<Uint8Array>
  | Blob
  | FormData
  | Iterable<Uint8Array>
  | NodeJS.ArrayBufferView
  | URLSearchParams
  | null
  | string

export type HTTPResponse = {
  headers: Headers
  body?: BodyInit | null | undefined
  /** @default 200 */
  status?: number
  /** @default "OK" */
  statusText?: string
}
export type HTTPHandler = (
  request: Request,
  response: HTTPResponse,
  route: MatchedRoute,
) => unknown
