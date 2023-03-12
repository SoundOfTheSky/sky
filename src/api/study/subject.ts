import { authCheck, PERMISSIONS } from '../../services/auth';
import { getSubject, answer, searchSubjects, getAllSubjects } from '../../services/study';
import { sendJSON, ValidationError } from '../../utils';
import type { ApiHandler } from '..';
// eslint-disable-next-line sonarjs/cognitive-complexity
export default (function (req, res, query) {
  if (!query.pathname.startsWith('/api/study/subjects')) return;
  const payload = authCheck(req, res, [PERMISSIONS.STUDY]);
  if (!payload) return;
  function getThemeIds() {
    const themeIds = query.searchParams
      .get('themeIds')
      ?.split(',')
      .map((el) => Number.parseInt(el));
    if (!themeIds || themeIds.some((el) => Number.isNaN(el)))
      throw new ValidationError('Theme IDs must all be integers separated with comma');
    return themeIds;
  }
  const splitQuery = query.pathname.split('/');
  if (splitQuery.length === 4) {
    const themeIds = getThemeIds();
    if (!themeIds) return;
    let page = Number.parseInt(query.searchParams.get('page')!);
    if (Number.isNaN(page)) page = 1;
    sendJSON(res, getAllSubjects(themeIds, page));
    return;
  }
  const subjectId = Number.parseInt(splitQuery[4]!);
  if (Number.isNaN(subjectId)) {
    if (req.method === 'GET') {
      const themeIds = getThemeIds();
      if (!themeIds) return;
      sendJSON(res, searchSubjects(themeIds, decodeURI(splitQuery[4]!)));
    } else throw new ValidationError('Subject ID must be integer');
  } else if (req.method === 'GET') sendJSON(res, getSubject(subjectId, payload.id));
  else if (req.method === 'POST') {
    answer(subjectId, payload.id, splitQuery[5] === 'correct');
    res.end();
  }
} as ApiHandler);
