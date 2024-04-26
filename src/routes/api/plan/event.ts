import { HTTPHandler } from '@/services/http/types';
import { sendJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { usersAnswersTable } from '@/services/study/users-answers';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.PLAN], throw401: true });
  const start = Number.parseInt(route.query['start']);
  const end = route.query['end'] ? Number.parseInt(route.query['end']) : undefined;
  if (Number.isNaN(start) || (end !== undefined && Number.isNaN(end)))
    throw new ValidationError('Start & end must be integers');
  sendJSON(res, usersAnswersTable.getUserStats(payload.user.id, start, end));
} satisfies HTTPHandler);
