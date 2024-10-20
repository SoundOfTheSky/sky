import { HTTPHandler } from '@/services/http/types';
import { sessionGuard } from '@/services/session';
import { reloadStatic } from '@/services/static';

export default (async function (req) {
  await sessionGuard({ req, permissions: ['ADMIN'], throw401: true });
  await reloadStatic();
} satisfies HTTPHandler);
