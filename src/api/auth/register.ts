import type { ApiHandler } from '..';
import { getDataFromRequest, sendJSON, ValidationError } from '../../utils';
import {
  addChallenge,
  authenticatorsTable,
  getRegistrationOptions,
  getSession,
  removeChallenge,
  setAuth,
  sign,
  usersTable,
  verifyRegistration,
} from '../../services/auth';
import type { RegistrationResponseJSON } from '@simplewebauthn/typescript-types';

export default (async function (req, res, query) {
  if (query.pathname !== '/api/auth/register') return;
  const [, session] = getSession(req, res);
  const username = query.searchParams.get('username');
  if (!username || !/^(?!.*_{2})\w{2,24}$/u.test(username))
    throw new ValidationError('Username must be 2-24 letters long without spaces');
  if (req.method === 'GET') {
    if (usersTable.checkIfUsernameExists(username)) throw new ValidationError('Username taken');
    removeChallenge(session);
    const options = getRegistrationOptions(username);
    addChallenge(session, options.challenge);
    sendJSON(res, options);
  } else {
    const expectedChallenge = session.challenge?.challenge;
    if (!expectedChallenge) throw new ValidationError('Challenge timeout');
    const rawData = await getDataFromRequest(req);
    const data = JSON.parse(rawData.toString()) as RegistrationResponseJSON;
    const verification = await verifyRegistration(expectedChallenge, data);
    removeChallenge(session);
    if (!verification.verified || !verification.registrationInfo) throw new ValidationError('Not verified');
    if (usersTable.checkIfUsernameExists(username)) throw new ValidationError('Username taken');
    const userId = usersTable.create({
      username,
      status: 0,
      permissions: [],
    }).lastInsertRowid as number;
    authenticatorsTable.create({
      counter: verification.registrationInfo.counter,
      credentialBackedUp: verification.registrationInfo.credentialBackedUp,
      credentialDeviceType: verification.registrationInfo.credentialDeviceType,
      credentialID: Buffer.from(verification.registrationInfo.credentialID),
      credentialPublicKey: Buffer.from(verification.registrationInfo.credentialPublicKey),
      transports: data.response.transports,
      userId,
    });
    setAuth(
      res,
      sign({
        id: userId,
        permissions: [],
        status: 0,
      }),
    );
    res.end();
  }
} as ApiHandler);
