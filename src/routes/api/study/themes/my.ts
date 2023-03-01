import { HTTPHandler, sendJSON } from '@/services/http';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { getThemes } from '@/services/study';

export default (async function (req, res) {
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  sendJSON(res, getThemes(payload.user.id));
} satisfies HTTPHandler);
