import { authCheck, PERMISSIONS } from '../../services/auth';
import { getQuestion, updateQuestionData } from '../../services/study';
import { getDataFromRequest, sendJSON, ValidationError } from '../../utils';
import type { ApiHandler } from '..';
export default (async function (req, res, query) {
  if (!query.pathname.startsWith('/api/study/questions/')) return;
  const payload = authCheck(req, res, [PERMISSIONS.STUDY]);
  if (!payload) return;
  const questionId = Number.parseInt(query.pathname.replace('/api/study/questions/', ''));
  if (Number.isNaN(questionId)) throw new ValidationError('Invalid id');
  if (req.method === 'GET') sendJSON(res, getQuestion(questionId, payload.id));
  else if (req.method === 'PATCH') {
    const rawData = await getDataFromRequest(req);
    const { note, synonyms } = JSON.parse(rawData.toString()) as {
      note?: string;
      synonyms?: string[];
    };
    updateQuestionData(payload.id, questionId, {
      note,
      synonyms,
    });
    res.end();
  }
} as ApiHandler);
