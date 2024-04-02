import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';

import { HTTPHandler } from '@/services/http/types';
import { HTTPError } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';
import { usersSubjectsTable } from '@/services/study/users-subjects';
import { ValidationError } from '@/utils';

const T = TypeCompiler.Compile(
  Type.Object({
    created: Type.Number({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    answers: Type.Array(
      Type.String({
        minLength: 1,
        maxLength: 64,
      }),
      {
        minItems: 1,
        maxItems: 9,
      },
    ),
    took: Type.Number({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    correct: Type.Boolean(),
  }),
);
export default (async function (req, res, route) {
  if (req.method !== 'POST') return;
  const payload = await sessionGuard({ req, res, permissions: [PERMISSIONS.STUDY], throw401: true });
  const subjectId = Number.parseInt(route.query['id']);
  if (Number.isNaN(subjectId)) throw new ValidationError('Subject id must be integer');
  const data = (await req.json()) as unknown;
  if (!T.Check(data)) throw new HTTPError('Validation error', 400, JSON.stringify([...T.Errors(data)]));
  usersSubjectsTable.answer(payload.user.id, subjectId, new Date(data.created), data.answers, data.correct, data.took);
} satisfies HTTPHandler);
