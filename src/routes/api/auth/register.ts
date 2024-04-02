import { RegistrationResponseJSON } from '@simplewebauthn/types';

import { lastInsertRowIdQuery } from '@/services/db';
import { HTTPHandler } from '@/services/http/types';
import { sendJSON } from '@/services/http/utils';
import { sessionGuard, setAuth, signJWT, verifyJWT } from '@/services/session';
import {
  getChallenge,
  getRegistrationOptions,
  removeChallenge,
  setChallenge,
  verifyRegistration,
} from '@/services/session/auth-process';
import { PERMISSIONS, authenticatorsTable, usersTable } from '@/services/session/user';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  const username = route.query['username'];
  if (!username || !/^(?!.*_{2})\w{2,24}$/u.test(username))
    throw new ValidationError('Username must be 2-24 letters long without spaces');
  const payload = await sessionGuard({ req, res });
  const registerKey = route.query['key'];
  const registerId = registerKey ? (await verifyJWT<{ id: number }>(registerKey))?.id : undefined;
  if (req.method === 'GET') {
    if (!registerId && usersTable.checkIfUsernameExists(username)) throw new ValidationError('Username taken');
    const options = await getRegistrationOptions(username);
    setChallenge(payload.sub, options.challenge);
    sendJSON(res, options);
  } else if (req.method === 'POST') {
    const expectedChallenge = getChallenge(payload.sub);
    if (!expectedChallenge) throw new ValidationError('Challenge timeout');
    const data = (await req.json()) as RegistrationResponseJSON;
    const verification = await verifyRegistration(expectedChallenge, data);
    removeChallenge(payload.sub);
    if (!verification.verified || !verification.registrationInfo) throw new ValidationError('Not verified');
    if (!registerId && usersTable.checkIfUsernameExists(username)) throw new ValidationError('Username taken');
    if (!registerId)
      usersTable.create({
        username,
        status: 0,
        permissions: [PERMISSIONS.STUDY],
      });
    const userId = registerId ?? lastInsertRowIdQuery.get()!.id;
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
      await signJWT(
        {
          ...payload,
          user: {
            id: userId,
            permissions: [],
            status: 0,
          },
        },
        {
          expiresIn: ~~(payload.exp - Date.now() / 1000),
        },
      ),
    );
  }
} satisfies HTTPHandler);
