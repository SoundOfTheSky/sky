import { HTTPHandler } from '@/services/http/types';
import { HTTPError, sendJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { usersTable } from '@/services/session/user';
import { ValidationError } from '@/sky-utils';

export default (async function (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return;
  const payload = await sessionGuard({ req, res, permissions: [], throw401: true });
  let user = usersTable.getById(payload.user.id);
  if (!user) throw new HTTPError('Not logged in', 401);
  if (req.method === 'POST') {
    const data = (await req.json()) as {
      avatar?: string;
      username?: string;
    };
    if (data.username && data.username !== user.username) {
      if (!/^(?!.*_{2})\w{2,24}$/u.test(data.username))
        throw new ValidationError('Username must be 2-24 letters long without spaces');
      if (usersTable.checkIfUsernameExists(data.username)) throw new ValidationError('Username taken');
    }
    if (data.avatar && data.avatar.length < 3 && data.avatar.length > 255)
      throw new ValidationError('Avatar URL is too big');
    usersTable.update(user.id, data);
    user = usersTable.getById(payload.user.id)!;
  }
  sendJSON(res, {
    id: user.id,
    avatar: user.avatar,
    username: user.username,
    created: user.created,
    permissions: user.permissions,
    status: user.status,
  });
} satisfies HTTPHandler);
