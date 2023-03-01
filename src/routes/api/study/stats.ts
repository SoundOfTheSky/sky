import { HTTPHandler } from '@/services/http';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { getStats } from '@/services/study';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const start = Number.parseInt(route.query['start']);
  const end = Number.parseInt(route.query['end']);
  if (Number.isNaN(start) || Number.isNaN(end)) throw new ValidationError('Start & end must be integers');
  res.body = getStats(payload.user.id, start, end)
    .map(([date, id, correct, themeId]) => `${Date.parse(date + 'Z')},${id},${correct},${themeId}`)
    .join('\n');
} satisfies HTTPHandler);
