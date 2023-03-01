import { HTTPHandler, sendJSON } from '@/services/http';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { getAllSRS } from '@/services/study';

export default (async function (req, res) {
  await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  sendJSON(res, getAllSRS());
} satisfies HTTPHandler);
