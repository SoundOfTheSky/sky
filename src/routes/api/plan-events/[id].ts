import { HTTPHandler } from '@/services/http/types';
import { sendJSON } from '@/services/http/utils';
import { planEventsTable } from '@/services/plan';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const questionId = Number.parseInt(route.params['id']);
  if (Number.isNaN(questionId)) throw new ValidationError('Invalid id');
  if (req.method === 'GET') sendJSON(res, planEventsTable.getByIdAndUser(questionId, payload.user.id));
} satisfies HTTPHandler);
