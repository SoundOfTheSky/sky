import { HTTPHandler } from '@/services/http/types';
import { sendJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { usersQuestionsTable } from '@/services/study/users-questions';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const questionId = Number.parseInt(route.params['id']);
  if (Number.isNaN(questionId)) throw new ValidationError('Invalid id');
  if (req.method === 'GET') sendJSON(res, usersQuestionsTable.getQuestion(questionId, payload.user.id));
  else if (req.method === 'PATCH') {
    const data = (await req.json()) as {
      note?: string;
      synonyms?: string[];
    };
    usersQuestionsTable.updateByQuestion(payload.user.id, questionId, {
      synonyms: data.synonyms?.map((a) => a.trim()).filter(Boolean),
      note: data.note?.trim(),
    });
  }
} satisfies HTTPHandler);
