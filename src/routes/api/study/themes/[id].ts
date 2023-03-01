import { HTTPHandler } from '@/services/http';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { addTheme, removeTheme } from '@/services/study';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const id = Number.parseInt(route.params['id']);
  if (Number.isNaN(id)) throw new ValidationError('Theme ID must be integer');
  if (req.method === 'POST') addTheme(payload.user.id, id);
  else if (req.method === 'DELETE') removeTheme(payload.user.id, id);
} satisfies HTTPHandler);
