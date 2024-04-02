import { HTTPHandler } from '@/services/http/types';
import { sendJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { srsTable } from '@/services/study/srs';

export default (async function (req, res) {
  await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  sendJSON(res, srsTable.getAll());
} satisfies HTTPHandler);
