import { HTTPHandler } from '@/services/http/types';
import { sessionGuard } from '@/services/session';
import { usersThemesTable } from '@/services/study/users-themes';
import { ValidationError } from '@/sky-utils';

export default (async function (req, res, route) {
  const payload = await sessionGuard({ req, res, permissions: ['STUDY'], throw401: true });
  const id = Number.parseInt(route.params['id']);
  if (Number.isNaN(id)) throw new ValidationError('Theme ID must be integer');
  if (req.method === 'POST') usersThemesTable.create({ userId: payload.user.id, themeId: id });
  else if (req.method === 'DELETE') usersThemesTable.deleteByIdUser(id, payload.user.id);
} satisfies HTTPHandler);
