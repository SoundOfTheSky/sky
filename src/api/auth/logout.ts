import type { ApiHandler } from '..';
import { deauth } from '../../services/auth';

export default (function (req, res, query) {
  if (query.pathname !== '/api/auth/logout' || req.method !== 'GET') return;
  deauth(res);
  res.end();
} as ApiHandler);
