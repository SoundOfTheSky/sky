import { HTTPHandler } from '@/services/http/types';
import { sendJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { usersThemesTable } from '@/services/study/users-themes';

export default (async (req, res) => {
  const session = await sessionGuard({
    req,
    res,
    permissions: ['STUDY'],
    throw401: true,
  });
  if (req.method === 'GET') sendJSON(res, usersThemesTable.getThemesData(session.user.id));
}) satisfies HTTPHandler;
