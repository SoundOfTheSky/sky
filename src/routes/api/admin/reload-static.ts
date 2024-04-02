import { HTTPHandler } from '@/services/http/types';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { reloadStatic } from '@/services/static';

export default (async function (req) {
  await sessionGuard({ req, permissions: [PERMISSIONS.ADMIN], throw401: true });
  await reloadStatic();
} satisfies HTTPHandler);
