import { signal } from '@softsky/utils'
import { decode } from 'cbor-x'

import { getRoute } from '@/services/routing/router'
import { WS } from '@/services/routing/types'
import { WebSocketMessageClient } from '@/sky-shared/web-socket'

export const $connectedWS = signal<WS>()
export const $disconnectedWS = signal<WS>()

export function wsMessageHandler(ws: WS, message: Buffer) {
  const data = decode(message) as WebSocketMessageClient
  const { handler, query, parameters } = getRoute(data.url)
  handler.websocket?.(ws, data, query, parameters)
}

export function wsCloseHandler(ws: WS) {
  $disconnectedWS(ws)
}

export function wsOpenHandler(ws: WS) {
  $connectedWS(ws)
}
