import { HTTPHandler } from '@/services/http/types';
import { HTTPError } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { usersQuestionsTable } from '@/services/study/users-questions';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  if (req.method !== 'GET') throw new HTTPError('Method not allowed', 405);
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const time = Number.parseInt(route.query['time']);
  if (Number.isNaN(time)) throw new ValidationError('Time must be integer');
  res.body = usersQuestionsTable
    .getUpdated(payload.user.id, time)
    .map(([id, time]) => id + ',' + time)
    .join('\n');
} satisfies HTTPHandler);
