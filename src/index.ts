import { file, serve } from 'bun';

import '@/preload';

import { DB } from '@/services/db';
import handleHTTP from '@/services/http';
import { WS, wsCloseHandler, wsMessageHandler, wsOpenHandler } from '@/services/ws';
import { log } from '@/utils';

const httpServer = serve({
  fetch: (req) => {
    let url = process.env['HTTP_ORIGIN']!;
    const i = req.url.indexOf('/', 8);
    if (i !== -1) url += req.url.slice(i);
    return Response.redirect(url);
  },
  port: process.env['HTTP_PORT'] ?? 80,
});
const server = serve<WS['data']>({
  port: process.env['PORT'] ?? 443,
  key: process.env['KEY'] ? file(process.env['KEY']) : undefined,
  cert: process.env['CERT'] ? file(process.env['CERT']) : undefined,
  ca: process.env['CHAIN'] ? file(process.env['CHAIN']) : undefined,
  fetch: handleHTTP,
  websocket: {
    message: wsMessageHandler,
    close: wsCloseHandler,
    open: wsOpenHandler,
  },
  maxRequestBodySize: 1024 * 1024, // 1mb
});
log('Started on ports', server.port, httpServer.port);

process.on('SIGHUP', onExit);
process.on('SIGINT', onExit);
process.on('SIGTERM', onExit);
process.on('uncaughtException', (e) => log(e));
function onExit() {
  log('Closing');
  DB.close();
  process.exit();
}

export default server;

// setTimeout(() => void import('./chiruno/test.js'), 1000);
// setTimeout(() => void import('./chiruno/clampIds.js'), 1000);
// setTimeout(() => void import('./chiruno/wanikani.js'), 1000);
// setTimeout(() => void import('./chiruno/importDeck.js'), 1000);
// setTimeout(() => void import('./chiruno/staticIsUsed.js'), 1000);
