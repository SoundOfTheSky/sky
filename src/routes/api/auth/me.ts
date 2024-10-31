import { HTTPHandler } from '@/services/http/types';
import { HTTPError, sendCompressedJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { User, usersTable } from '@/services/session/users';
import { Optional, ValidationError } from '@/sky-utils';

export default (async function (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return;
  const payload = await sessionGuard({
    req,
    res,
    permissions: [],
    throw401: true,
  });
  let user = usersTable.getById(payload.user.id) as
    | Optional<User, 'password'>
    | undefined;
  if (!user) throw new HTTPError('Not logged in', 401);
  if (req.method === 'POST') {
    const data = (await req.json()) as {
      avatar?: string;
      username?: string;
    };
    if (data.username && data.username !== user.username) {
      if (!/^(?!.*_{2})\w{2,24}$/u.test(data.username))
        throw new ValidationError(
          'Username must be 2-24 letters long without spaces',
        );
      if (usersTable.$getByUsername.get({ username: data.username }))
        throw new ValidationError('Username taken');
    }
    if (data.avatar && data.avatar.length < 3 && data.avatar.length > 255)
      throw new ValidationError('Avatar URL is too big');
    usersTable.update(user.id, data);
    user = usersTable.getById(payload.user.id)!;
  }
  delete user.password;
  sendCompressedJSON(res, user);
} satisfies HTTPHandler);
