import { HTTPHandler, sendJSON } from '@/services/http';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { getQuestion, updateQuestionData } from '@/services/study';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const questionId = Number.parseInt(route.params['id']);
  if (Number.isNaN(questionId)) throw new ValidationError('Invalid id');
  if (req.method === 'GET') sendJSON(res, getQuestion(questionId, payload.user.id));
  else if (req.method === 'PATCH') {
    updateQuestionData(
      payload.user.id,
      questionId,
      (await req.json()) as {
        note?: string;
        synonyms?: string[];
      },
    );
  }
} satisfies HTTPHandler);
