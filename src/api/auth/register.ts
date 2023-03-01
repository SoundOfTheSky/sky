import type { ApiHandler } from '..';
import { sendJSON } from '../../utils';
import { startRegistration } from '../../services/auth';

export default (function (req, res, query) {
  if (query.pathname !== '/api/auth/register' || req.method !== 'GET') return;
  const username = query.searchParams.get('username');
  if (!username) {
    res.writeHead(400).end('Username is not provided');
    return;
  }
  if (!/^(?!.*_{2})\w{2,24}$/u.test(username)) {
    res.writeHead(400).end('Username must be 2-24 letters long without spaces');
    return;
  }
  sendJSON(res, startRegistration(username));
} as ApiHandler);
