import { backupDB } from '@/services/db';
import { HTTPHandler } from '@/services/http/types';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';

export default (async function (req) {
  await sessionGuard({ req, permissions: [PERMISSIONS.ADMIN], throw401: true });
  await backupDB();
} satisfies HTTPHandler);
