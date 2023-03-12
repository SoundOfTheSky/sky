import { authCheck, PERMISSIONS } from '../../services/auth';
import { getSRS, getAllSRS } from '../../services/study';
import { sendJSON, ValidationError } from '../../utils';
import type { ApiHandler } from '..';
export default (function (req, res, query) {
  if (!query.pathname.startsWith('/api/study/srs')) return;
  const payload = authCheck(req, res, [PERMISSIONS.STUDY]);
  if (!payload) return;
  const splitQuery = query.pathname.split('/');
  if (splitQuery.length === 4) {
    sendJSON(res, getAllSRS());
    return;
  }
  const srsId = Number.parseInt(splitQuery[4]!);
  if (Number.isNaN(srsId)) throw new ValidationError('Invalid id');
  sendJSON(res, getSRS(srsId));
} as ApiHandler);
