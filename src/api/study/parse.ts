import { authCheck, PERMISSIONS } from '../../services/auth';
import { syncWK as parse } from '../../services/study';
import { sendJSON } from '../../utils';
import type { ApiHandler } from '..';
export default (async function (req, res, query) {
  if (query.pathname !== '/api/study/parse' || req.method !== 'POST') return;
  const payload = authCheck(req, res, [PERMISSIONS.ADMIN]);
  if (!payload) {
    if (!res.headersSent && res.writable) res.writeHead(401).end();
    return;
  }
  const resp = await parse();
  sendJSON(res, resp);
} as ApiHandler);
