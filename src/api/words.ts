import { authCheck } from '../services/auth';
import { wordsTable } from '../services/words';
import type { ApiHandler } from '.';

export default (function (req, res, query) {
  if (!query.pathname.startsWith('/api/words/') || req.method !== 'GET') return;
  const payload = authCheck(req, res);
  if (!payload) {
    if (!res.headersSent && res.writable) res.writeHead(401).end();
    return;
  }
  const wordId = Number.parseInt(query.pathname.replace('/api/words/', ''));
  if (Number.isNaN(wordId)) {
    res.writeHead(400).end('Word ID must be integer');
    return;
  }
  const word = wordsTable.get(wordId);
  if (!word) {
    res.writeHead(404).end();
    return;
  }
  res.end(word.word);
} as ApiHandler);
