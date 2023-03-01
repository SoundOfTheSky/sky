import type { AuthenticationResponseJSON } from '@simplewebauthn/typescript-types';
import type { ApiHandler } from '..';
import { getDataFromRequest } from '../../utils';
import { setAuth, verifyLogin } from '../../services/auth';

export default (async function (req, res, query) {
  if (query.pathname !== '/api/auth/login' || req.method !== 'POST') return;
  const rawData = await getDataFromRequest(req);
  const data = JSON.parse(rawData.toString()) as AuthenticationResponseJSON;
  const username = query.searchParams.get('username');
  if (!username) {
    res.writeHead(400).end('Username is not provided');
    return;
  }
  setAuth(res, await verifyLogin(username, data));
  res.end();
} as ApiHandler);
