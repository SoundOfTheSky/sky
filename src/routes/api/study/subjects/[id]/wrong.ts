import { HTTPError, HTTPHandler } from '@/services/http';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { answer } from '@/services/study';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const subjectId = Number.parseInt(route.query['id']);
  if (Number.isNaN(subjectId)) throw new ValidationError('Subject id must be integer');
  if (req.method !== 'POST') throw new HTTPError('Method Not Allowed', 405);
  answer(subjectId, payload.user.id, false);
} satisfies HTTPHandler);
