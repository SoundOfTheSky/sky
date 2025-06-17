import { log } from '@softsky/utils'
import { file, serve } from 'bun'

import '@/preload.ts'

import handleHTTP from '@/services/routing/http'
import { WS } from '@/services/routing/types'
import {
  wsCloseHandler,
  wsMessageHandler,
  wsOpenHandler,
} from '@/services/routing/web-socket'

const httpServer = serve({
  fetch: (request) => {
    let url = process.env.HTTP_ORIGIN!
    const index = request.url.indexOf('/', 8)
    if (index !== -1) url += request.url.slice(index)
    return Response.redirect(url, 301)
  },
  port: process.env.HTTP_PORT ?? 80,
})
globalThis.server = serve<WS['data'], object>({
  port: process.env.PORT ?? 443,
  key: process.env.KEY ? file(process.env.KEY) : undefined,
  cert: process.env.CERT ? file(process.env.CERT) : undefined,
  ca: process.env.CHAIN ? file(process.env.CHAIN) : undefined,
  ...(process.env.CERT
    ? {
        rejectUnauthorized: false,
      }
    : {}),
  fetch: handleHTTP,
  websocket: {
    message: wsMessageHandler,
    close: wsCloseHandler,
    open: wsOpenHandler,
  },
  maxRequestBodySize: Infinity,
  idleTimeout: 30,
  development: false,
})
log('Started on ports', server!.port, httpServer.port)

process.on('SIGHUP', onExit)
process.on('SIGINT', onExit)
process.on('SIGTERM', onExit)
process.on('uncaughtException', (error) => {
  log(error)
})
function onExit() {
  log('Closing')
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit()
}
// setTimeout(() => void import('./chiruno/test.js'), 1000);
// setTimeout(() => void import('./chiruno/clampIds.js'), 1000);
// setTimeout(() => void import('./chiruno/wanikani.js'), 1000);
// setTimeout(() => void import('./chiruno/importDeck.js'), 1000);
// setTimeout(() => void import('./chiruno/staticIsUsed.js'), 1000);
