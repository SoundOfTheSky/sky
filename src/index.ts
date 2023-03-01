import https from 'node:https';
import http, { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import { readFileSync } from 'node:fs';
import './load-envs';
import api from './api';
import { DB } from './db';
import { log, sendRedirect } from './utils';
os.setPriority(19);

const PORT = process.env['PORT'] ? +process.env['PORT'] : 80;
log(`Running on port ${PORT}`);
http.createServer(PORT ? handler : redirectToHTTPS).listen(PORT);
if (!process.env['PORT'])
  https
    .createServer(
      {
        key: readFileSync(process.env['KEY'] ?? 'privkey.pem', 'utf8'),
        cert: readFileSync(process.env['CERT'] ?? 'cert.pem', 'utf8'),
        ca: readFileSync(process.env['CHAIN'] ?? 'chain.pem', 'utf8'),
      },
      handler,
    )
    .listen(443);

function handler(req: IncomingMessage, res: ServerResponse) {
  const query = new URL(req.url!, 'https://soundofthesky.ga');
  log(req.socket.remoteAddress, req.method, req.url);
  void api(req, res, query);
}
function redirectToHTTPS(req: IncomingMessage, res: ServerResponse) {
  sendRedirect(res, process.env['HTTP_ORIGIN']! + req.url!);
}
process.on('exit', () => {
  DB.close();
});
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));
process.on('uncaughtException', (e) => log(e));
