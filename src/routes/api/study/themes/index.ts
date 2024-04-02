import { HTTPHandler } from '@/services/http/types';
import { sendJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { usersThemesTable } from '@/services/study/users-themes';

export default (async function (req, res) {
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  sendJSON(res, usersThemesTable.getThemesData(payload.user.id));
} satisfies HTTPHandler);
