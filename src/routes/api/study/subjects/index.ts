import { HTTPHandler, sendJSON } from '@/services/http';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { getAllSubjects } from '@/services/study';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const themeIds = route.query['themes']?.split(',').map((el) => Number.parseInt(el));
  if (!themeIds || themeIds.some((el) => Number.isNaN(el)))
    throw new ValidationError('Theme IDs must all be integers separated with comma');
  let page = Number.parseInt(route.query['page']!);
  if (Number.isNaN(page)) page = 1;
  sendJSON(res, getAllSubjects(themeIds, page));
} satisfies HTTPHandler);
