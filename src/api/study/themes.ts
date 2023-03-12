import { authCheck, PERMISSIONS } from '../../services/auth';
import { addTheme, getThemes, removeTheme } from '../../services/study';
import { sendJSON, ValidationError } from '../../utils';
import type { ApiHandler } from '..';
export default (function (req, res, query) {
  if (!query.pathname.startsWith('/api/study/themes')) return;
  const payload = authCheck(req, res, [PERMISSIONS.STUDY]);
  if (!payload) return;
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
      if (Number.isNaN(themeId)) throw new ValidationError('Theme ID must be integer');
      addTheme(payload.id, themeId);
      res.end();

      break;
    }
    case 'DELETE': {
      const themeId = Number.parseInt(splitQuery[4]!);
      if (Number.isNaN(themeId)) throw new ValidationError('Theme ID must be integer');
      removeTheme(payload.id, themeId);
      res.end();

      break;
    }
  }
} as ApiHandler);
