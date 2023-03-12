import { authCheck } from '../services/auth';
import { wordsTable } from '../services/words';
import type { ApiHandler } from '.';
import { ValidationError } from '../utils';

export default (function (req, res, query) {
  if (!query.pathname.startsWith('/api/words/') || req.method !== 'GET') return;
  if (!authCheck(req, res)) return;
  const wordId = Number.parseInt(query.pathname.replace('/api/words/', ''));
  if (Number.isNaN(wordId)) throw new ValidationError('Word ID must be integer');
  const word = wordsTable.get(wordId);
  if (!word) {
    res.writeHead(404).end();
    return;
  }
  res.end(word.word);
} as ApiHandler);
