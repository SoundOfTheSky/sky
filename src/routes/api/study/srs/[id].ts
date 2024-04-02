import { HTTPHandler } from '@/services/http/types';
import { sendJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { srsTable } from '@/services/study/srs';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const srsId = Number.parseInt(route.params['id']);
  if (Number.isNaN(srsId)) throw new ValidationError('Invalid id');
  sendJSON(res, srsTable.get(srsId));
} satisfies HTTPHandler);
