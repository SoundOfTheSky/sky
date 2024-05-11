import { HTTPHandler } from '@/services/http/types';
import { HTTPError } from '@/services/http/utils';
import { planEventsTable } from '@/services/plan';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  if (req.method !== 'GET') throw new HTTPError('Method not allowed', 405);
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const time = Number.parseInt(route.query['time']);
  if (Number.isNaN(time)) throw new ValidationError('Time must be integer');
  res.body = planEventsTable
    .getUpdated(payload.user.id, time)
    .map(([id, time]) => id + ',' + time)
    .join('\n');
} satisfies HTTPHandler);
