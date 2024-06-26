import { HTTPHandler } from '@/services/http/types';
import { sendJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { usersSubjectsTable } from '@/services/study/users-subjects';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const themeIds = route.query['themes']?.split(',').map((el) => Number.parseInt(el));
  if (!themeIds || themeIds.some((el) => Number.isNaN(el)))
    throw new ValidationError('Theme IDs must all be integers separated with comma');
  let page = Number.parseInt(route.query['page']);
  if (Number.isNaN(page)) page = 1;
  sendJSON(res, usersSubjectsTable.search(themeIds, undefined, page));
} satisfies HTTPHandler);
