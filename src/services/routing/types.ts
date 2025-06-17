import { ServerWebSocket } from 'bun'

import { SessionPayload } from '@/services/session/session'
import { WebSocketMessageClient } from '@/sky-shared/web-socket'

export type WS = ServerWebSocket<{
  session: SessionPayload
}>

export type WSEventHandler = (ws: WS, payload?: string) => unknown

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
  query: Record<string, string>,
  parameters: Record<string, string>,
) => unknown

export type RouterHandler = {
  http?: HTTPHandler
  websocket?: WebSocketHandler
}

export type WebSocketHandler = (
  websocket: WS,
  type: WebSocketMessageClient,
  query: Record<string, string>,
  parameters: Record<string, string>,
) => unknown
