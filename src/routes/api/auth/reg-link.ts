import { HTTPHandler } from '@/services/http/types';
import { sessionGuard, signJWT } from '@/services/session';

export default (async function (req, res) {
  const payload = await sessionGuard({ req, res, throw401: true, permissions: [] });
  const token = await signJWT(
    {
      id: payload.user.id,
    },
    {
      expiresIn: 1800,
    },
  );
  res.body = token.access_token;
} satisfies HTTPHandler);
