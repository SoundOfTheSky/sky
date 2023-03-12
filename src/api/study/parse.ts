import { authCheck, PERMISSIONS } from '../../services/auth';
import { syncWK as parse } from '../../services/study';
import { sendJSON } from '../../utils';
import type { ApiHandler } from '..';
export default (async function (req, res, query) {
  if (query.pathname !== '/api/study/parse' || req.method !== 'POST') return;
  if (!authCheck(req, res, [PERMISSIONS.ADMIN])) return;
  const resp = await parse();
  sendJSON(res, resp);
} as ApiHandler);
