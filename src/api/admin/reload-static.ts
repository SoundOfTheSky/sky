import { authCheck, PERMISSIONS } from '../../services/auth';
import type { ApiHandler } from '..';
import { reloadStatic } from '../../services/static';

export default (async function (req, res, query) {
  if (query.pathname !== '/api/admin/reload-static') return;
  const payload = authCheck(req, res, [PERMISSIONS.ADMIN]);
  if (!payload) {
    if (!res.headersSent && res.writable) res.writeHead(401).end();
    return;
  }
  await reloadStatic();
  res.end();
} as ApiHandler);
