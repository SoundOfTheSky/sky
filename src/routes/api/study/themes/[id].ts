import { HTTPHandler } from '@/services/http/types';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { usersThemesTable } from '@/services/study/users-themes';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const id = Number.parseInt(route.params['id']);
  if (Number.isNaN(id)) throw new ValidationError('Theme ID must be integer');
  if (req.method === 'POST') usersThemesTable.addToUser(payload.user.id, id);
  else if (req.method === 'DELETE') usersThemesTable.removeFromUser(payload.user.id, id);
} satisfies HTTPHandler);
