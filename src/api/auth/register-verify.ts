import type { RegistrationResponseJSON } from '@simplewebauthn/typescript-types';
import type { ApiHandler } from '..';
import { getDataFromRequest } from '../../utils';
import { setAuth, verifyRegistration } from '../../services/auth';

export default (async function (req, res, query) {
  if (query.pathname !== '/api/auth/register' || req.method !== 'POST') return;
  const rawData = await getDataFromRequest(req);
  const data = JSON.parse(rawData.toString()) as RegistrationResponseJSON;
  const username = query.searchParams.get('username');
  if (!username) {
    res.writeHead(400).end('Username is not provided');
    return;
  }
  if (!/^(?!.*_{2})\w{2,24}$/u.test(username)) {
    res.writeHead(400).end('Username must be 2-24 letters long without spaces');
    return;
  }
  setAuth(res, await verifyRegistration(username, data));
  res.end();
} as ApiHandler);
