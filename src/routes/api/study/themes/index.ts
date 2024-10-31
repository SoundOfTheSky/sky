import { HTTPHandler } from '@/services/http/types';
import { sendCompressedJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { usersThemesTable } from '@/services/study/users-themes';

export default (async (req, res) => {
  const session = await sessionGuard({
    req,
    res,
    permissions: ['STUDY'],
    throw401: true,
  });
  if (req.method === 'GET')
    sendCompressedJSON(res, usersThemesTable.getThemesData(session.user.id));
}) satisfies HTTPHandler;
