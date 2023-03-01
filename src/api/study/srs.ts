import { authCheck, PERMISSIONS } from '../../services/auth';
import { getSRS, getAllSRS } from '../../services/study';
import { sendJSON } from '../../utils';
import type { ApiHandler } from '..';
export default (function (req, res, query) {
  if (!query.pathname.startsWith('/api/study/srs')) return;
  const payload = authCheck(req, res, [PERMISSIONS.STUDY]);
  if (!payload) {
    if (!res.headersSent && res.writable) res.writeHead(401).end();
    return;
  }
  const splitQuery = query.pathname.split('/');
  if (splitQuery.length === 4) {
    sendJSON(res, getAllSRS());
    return;
  }
  const srsId = Number.parseInt(splitQuery[4]!);
  if (Number.isNaN(srsId)) {
    res.writeHead(400).end('SRS ID must be integer');
    return;
  }
  sendJSON(res, getSRS(srsId));
} as ApiHandler);
