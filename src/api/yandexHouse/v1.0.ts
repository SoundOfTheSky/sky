import { authCheck, PERMISSIONS } from '../../services/auth';
import type { ApiHandler } from '..';
export default (function (req, res, query) {
  if (query.pathname !== '/api/yandex-house/v1.0') return;
  if (!authCheck(req, res, [PERMISSIONS.HOUSE])) return;
  res.end();
} as ApiHandler);
