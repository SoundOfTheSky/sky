import { authCheck, PERMISSIONS } from '../../services/auth';
import type { ApiHandler } from '..';
import { reloadStatic } from '../../services/static';

export default (async function (req, res, query) {
  if (query.pathname !== '/api/admin/reload-static') return;
  if(!authCheck(req, res, [PERMISSIONS.ADMIN])) return;
  await reloadStatic();
  res.end();
} as ApiHandler);
