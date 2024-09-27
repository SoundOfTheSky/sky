import { HTTPHandler } from '@/services/http/types';
import { sendCompressedJSON } from '@/services/http/utils';
import { sessionGuard, setAuth, signJWT } from '@/services/session';
import {
  getChallenge,
  getLoginOptions,
  removeChallenge,
  setChallenge,
  verifyLogin,
} from '@/services/session/auth-process';
import { authenticatorsTable, usersTable } from '@/services/session/user';
import { ValidationError } from '@/sky-utils';

import type { AuthenticationResponseJSON } from '@simplewebauthn/types';

export default (async function (req, res, route) {
  const username = route.query['username'];
  if (!username) throw new ValidationError('Invalid username');
  const user = usersTable.convertFrom(usersTable.$getByUsername.get({ username }));
  if (!user) throw new ValidationError('User not found');
  const payload = await sessionGuard({ req, res });
  if (req.method === 'GET') {
    const options = await getLoginOptions(
      authenticatorsTable.convertFromMany(authenticatorsTable.$getByUserId.all({ id: user.id })),
    );
    setChallenge(payload.sub, options.challenge);
    sendCompressedJSON(res, options);
  } else if (req.method === 'POST') {
    const expectedChallenge = getChallenge(payload.sub);
    if (!expectedChallenge) throw new ValidationError('Challenge timeout');
    const data = (await req.json()) as AuthenticationResponseJSON;
    const authenticator = authenticatorsTable.getById(data.id);
    if (!authenticator) throw new ValidationError('Authenticator not found');
    const verification = await verifyLogin(authenticator, expectedChallenge, data);
    removeChallenge(payload.sub);
    if (!verification.verified) throw new ValidationError('Not verified');
    authenticatorsTable.$updateCounter.run({ user_id: user.id, counter: verification.authenticationInfo.newCounter });
    setAuth(
      res,
      await signJWT(
        {
          ...payload,
          user: {
            id: user.id,
            permissions: user.permissions,
            status: user.status,
          },
        },
        {
          expiresIn: ~~(payload.exp - Date.now() / 1000),
        },
      ),
    );
  }
} satisfies HTTPHandler);
