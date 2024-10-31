import { HTTPHandler } from '@/services/http/types';
import { sessionGuard } from '@/services/session';
import { usersThemesTable } from '@/services/study/users-themes';
import { parseInt } from '@/sky-utils';

export default (async function (req, res, route) {
  const payload = await sessionGuard({
    req,
    res,
    permissions: ['STUDY'],
    throw401: true,
  });
  const id = parseInt(route.params.id);
  if (req.method === 'POST')
    usersThemesTable.create({ userId: payload.user.id, themeId: id });
  else if (req.method === 'DELETE')
    usersThemesTable.deleteByIdUser(id, payload.user.id);
} satisfies HTTPHandler);
