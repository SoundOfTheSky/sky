import { HTTPHandler } from '@/services/http';
import { sessionGuard } from '@/services/session';
import { wordsTable } from '@/services/words';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  await sessionGuard({ req, res, permissions: [], throw401: true });
  const id = Number.parseInt(route.params['id']);
  if (Number.isNaN(id)) throw new ValidationError('Word ID must be integer');
  const word = wordsTable.get(id);
  if (word) res.body = word.word;
  else res.status = 404;
} satisfies HTTPHandler);
