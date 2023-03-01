import type { ApiHandler } from '..';
import { getCookies, sendJSON } from '../../utils';
import { deauth, usersTable, verify } from '../../services/auth';

export default (function (req, res, query) {
  if (query.pathname !== '/api/auth/me' || req.method !== 'GET') return;
  const authorization = getCookies(req)['Authorization'];
  if (!authorization) {
    res.writeHead(401).end();
    return;
  }
  const payload = verify(authorization);
  if (!payload) {
    res.writeHead(401).end();
    return;
  }
  const user = usersTable.get(payload.id);
  if (!user) {
    deauth(res);
    res.end();
    return;
  }
  sendJSON(res, {
    id: user.id,
    avatar: user.avatar,
    username: user.username,
    created: user.created,
    permissions: user.permissions,
    status: user.status,
  });
} as ApiHandler);
