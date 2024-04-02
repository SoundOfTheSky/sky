import { HTTPHandler } from '@/services/http/types';
import { HTTPError } from '@/services/http/utils';
import { sessionGuard, setAuth, signJWT } from '@/services/session';

export default (async function (req, res) {
  const payload = await sessionGuard({ req, res });
  if (!payload.user) throw new HTTPError('Not logged in', 401);
  delete payload.user;
  setAuth(
    res,
    await signJWT(
      {
        ...payload,
      },
      {
        expiresIn: ~~(payload.exp - Date.now() / 1000),
      },
    ),
  );
} satisfies HTTPHandler);
