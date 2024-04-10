import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';

import { HTTPHandler } from '@/services/http/types';
import { HTTPError, sendJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { usersQuestionsTable } from '@/services/study/users-questions';
import { ValidationError } from '@/utils';

const T = TypeCompiler.Compile(
  Type.Object({
    note: Type.Optional(
      Type.String({
        minLength: 0,
        maxLength: 4096,
      }),
    ),
    synonyms: Type.Optional(
      Type.Array(
        Type.String({
          minLength: 1,
          maxLength: 64,
        }),
        {
          minItems: 0,
          maxItems: 9,
        },
      ),
    ),
  }),
);

export default (async function (req, res, route) {
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const questionId = Number.parseInt(route.params['id']);
  if (Number.isNaN(questionId)) throw new ValidationError('Invalid id');
  if (req.method === 'GET') sendJSON(res, usersQuestionsTable.getQuestion(questionId, payload.user.id));
  else if (req.method === 'PUT') {
    const data = (await req.json()) as {
      note?: string;
      synonyms?: string[];
    };
    if (!T.Check(data)) throw new HTTPError('Validation error', 400, JSON.stringify([...T.Errors(data)]));
    usersQuestionsTable.updateByQuestion(
      payload.user.id,
      questionId,
      data.note?.trim(),
      data.synonyms?.map((a) => a.trim()).filter(Boolean),
    );
  }
} satisfies HTTPHandler);
