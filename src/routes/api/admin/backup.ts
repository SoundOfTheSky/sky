import { backupDB } from '@/services/db';
import { HTTPHandler } from '@/services/http/types';
import { sessionGuard } from '@/services/session';

export default (async function (req) {
  await sessionGuard({ req, permissions: ['ADMIN'], throw401: true });
  await backupDB();
} satisfies HTTPHandler);
