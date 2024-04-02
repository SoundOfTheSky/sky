import { ServerWebSocket } from 'bun';

import { JWTPayload } from '@/services/session';

export type WS = ServerWebSocket<{
  jwt: JWTPayload;
  chat?: {
    username: string;
    avatar?: string;
  };
}>;
export function wsMessageHandler(ws: WS, message: string | Buffer) {
  if (typeof message !== 'string') return;
  const i = message.indexOf(' ');
  if (i === -1) dispatchWSEvent(ws, message);
  else dispatchWSEvent(ws, message.slice(0, i), message.slice(i));
}

export function wsCloseHandler(ws: WS) {
  dispatchWSEvent(ws, 'close');
}

export function wsOpenHandler(ws: WS) {
  dispatchWSEvent(ws, 'open');
}

type WSEventHandler = (ws: WS, payload?: string) => unknown;
const eventHandlers = new Map<string, WSEventHandler[]>();
export function subscribeWSEvent(event: string, handler: WSEventHandler) {
  let handlers = eventHandlers.get(event);
  if (!handlers) {
    handlers = [];
    eventHandlers.set(event, handlers);
  }
  handlers.push(handler);
}

export function dispatchWSEvent(ws: WS, event: string, payload?: string) {
  const handlers = eventHandlers.get(event);
  if (handlers) for (const handler of handlers) handler(ws, payload);
}
