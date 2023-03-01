import type { ApiHandler } from '..';
import { sendJSON } from '../../utils';
import { startLogin } from '../../services/auth';

export default (function (req, res, query) {
  if (query.pathname !== '/api/auth/login' || req.method !== 'GET') return;
  const username = query.searchParams.get('username');
  if (!username) {
    res.writeHead(400).end('Username not provided');
    return;
  }
  sendJSON(res, startLogin(username));
} as ApiHandler);
