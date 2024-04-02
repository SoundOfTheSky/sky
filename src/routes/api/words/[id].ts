import { HTTPHandler } from '@/services/http/types';
import { HTTPError, sendJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { wordsTable } from '@/services/words';
import { ValidationError } from '@/utils';

export default (async function (req, res, route) {
  await sessionGuard({ req, res, permissions: [], throw401: true });
  const id = Number.parseInt(route.params['id']);
  if (Number.isNaN(id)) throw new ValidationError('Word ID must be integer');
  const word = wordsTable.get(id);
  if (!word) throw new HTTPError('Not found', 404);
  sendJSON(res, word);
} satisfies HTTPHandler);
