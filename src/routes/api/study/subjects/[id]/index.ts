import { HTTPHandler, sendJSON } from '@/services/http';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { answer, getSubject, searchSubjects } from '@/services/study';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const subjectId = Number.parseInt(route.query['id']);
  if (Number.isNaN(subjectId)) {
    const themeIds = route.query['themes']?.split(',').map((el) => Number.parseInt(el));
    if (!themeIds || themeIds.some((el) => Number.isNaN(el)))
      throw new ValidationError('Theme IDs must all be integers separated with comma');
    let page = Number.parseInt(route.query['page']);
    if (Number.isNaN(page)) page = 1;
    sendJSON(res, searchSubjects(themeIds, decodeURI(route.query['id']), page));
  } else if (req.method === 'GET') sendJSON(res, getSubject(subjectId, payload.user.id));
  else if (req.method === 'POST') answer(subjectId, payload.user.id, route.query['id'] === 'correct');
} satisfies HTTPHandler);
