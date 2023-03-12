import type { ApiHandler } from '..';
import { getDataFromRequest, sendJSON, ValidationError } from '../../utils';
import {
  addChallenge,
  authenticatorsTable,
  getLoginOptions,
  getSession,
  removeChallenge,
  setAuth,
  sign,
  usersTable,
  verifyLogin,
} from '../../services/auth';
import type { AuthenticationResponseJSON } from '@simplewebauthn/typescript-types';

export default (async function (req, res, query) {
  if (query.pathname !== '/api/auth/login') return;
  const [, session] = getSession(req, res);
  const username = query.searchParams.get('username');
  if (!username) throw new ValidationError('Invalid username');
  const user = usersTable.getByUsername(username);
  if (!user) throw new ValidationError('User not found');
  if (req.method === 'GET') {
    removeChallenge(session);
    const options = getLoginOptions(authenticatorsTable.getAllByUser(user.id));
    addChallenge(session, options.challenge);
    sendJSON(res, options);
  } else {
    const expectedChallenge = session.challenge?.challenge;
    if (!expectedChallenge) throw new ValidationError('Challenge timeout');
    const rawData = await getDataFromRequest(req);
    const data = JSON.parse(rawData.toString()) as AuthenticationResponseJSON;
    const authenticator = authenticatorsTable.get(data.id);
    if (!authenticator) throw new ValidationError('Authenticator not found');
    const verification = await verifyLogin(authenticator, expectedChallenge, data);
    removeChallenge(session);
    if (!verification.verified) throw new ValidationError('Not verified');
    setAuth(
      res,
      sign({
        id: user.id,
        permissions: user.permissions,
        status: user.status,
      }),
    );
    res.end();
  }
} as ApiHandler);
