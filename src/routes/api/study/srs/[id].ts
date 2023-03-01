import { HTTPHandler, sendJSON } from '@/services/http';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { getSRS } from '@/services/study';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const srsId = Number.parseInt(route.params['id']);
  if (Number.isNaN(srsId)) throw new ValidationError('Invalid id');
  sendJSON(res, getSRS(srsId));
} satisfies HTTPHandler);
