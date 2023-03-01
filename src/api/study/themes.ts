import { authCheck, PERMISSIONS } from '../../services/auth';
import { addTheme, getThemes, removeTheme } from '../../services/study';
import { sendJSON } from '../../utils';
import type { ApiHandler } from '..';
export default (function (req, res, query) {
  if (!query.pathname.startsWith('/api/study/themes')) return;
  const payload = authCheck(req, res, [PERMISSIONS.STUDY]);
  if (!payload) {
    if (!res.headersSent && res.writable) res.writeHead(401).end();
    return;
  }
  const splitQuery = query.pathname.split('/');
  switch (req.method) {
    case 'GET': {
      if (splitQuery[4] === 'my') {
        sendJSON(res, getThemes(payload.id));
        return;
      }
      sendJSON(res, getThemes());

      break;
    }
    case 'POST': {
      const themeId = Number.parseInt(splitQuery[4]!);
      if (Number.isNaN(themeId)) {
        res.writeHead(400).end('Theme ID must be integer');
        return;
      }
      addTheme(payload.id, themeId);
      res.end();

      break;
    }
    case 'DELETE': {
      const themeId = Number.parseInt(splitQuery[4]!);
      if (Number.isNaN(themeId)) {
        res.writeHead(400).end('Theme ID must be integer');
        return;
      }
      removeTheme(payload.id, themeId);
      res.end();

      break;
    }
  }
} as ApiHandler);
