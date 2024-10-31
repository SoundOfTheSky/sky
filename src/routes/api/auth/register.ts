import { LoginT } from '@/routes/api/auth/login';
import { HTTPHandler } from '@/services/http/types';
import { getRequestBodyT } from '@/services/http/utils';
import { sessionGuard, setAuth, signJWT } from '@/services/session';
import { usersTable } from '@/services/session/users';
import { ValidationError } from '@/sky-utils';

export default (async function (req, res) {
  if (req.method !== 'POST') return;
  const [payload, body] = await Promise.all([
    sessionGuard({ req, res }),
    getRequestBodyT(req, LoginT),
  ]);
  if (usersTable.$getByUsername.get(body))
    throw new ValidationError('Username taken');
  const userId = usersTable.create({
    username: body.username,
    password: await Bun.password.hash(body.password),
    status: 0,
    permissions: ['STUDY'],
  }).lastInsertRowid as number;
  setAuth(
    res,
    await signJWT(
      {
        ...payload,
        user: {
          id: userId,
          permissions: ['STUDY'],
          status: 0,
        },
      },
      {
        expiresIn: ~~(payload.exp - Date.now() / 1000),
      },
    ),
  );
} satisfies HTTPHandler);
