import { HTTPHandler } from '@/services/http';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { getStats } from '@/services/study';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const start = Number.parseInt(route.query['start']);
  const end = Number.parseInt(route.query['end']);
  const timezone = Number.parseInt(route.query['timezone']);
  if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(timezone))
    throw new ValidationError('Start & end must be integers');
  res.body = getStats(payload.user.id, start, end, timezone)
    .map(([date, themeId, count]) => `${date},${themeId},${count}`)
    .join('\n');
} satisfies HTTPHandler);
