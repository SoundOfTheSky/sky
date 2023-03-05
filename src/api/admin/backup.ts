import { authCheck, PERMISSIONS } from '../../services/auth';
import { backupDB, loadBackupDB } from '../../db';
import type { ApiHandler } from '..';

export default (async function (req, res, query) {
  if (!query.pathname.startsWith('/api/admin/backup')) return;
  const payload = authCheck(req, res, [PERMISSIONS.ADMIN]);
  if (!payload) {
    if (!res.headersSent && res.writable) res.writeHead(401).end();
    return;
  }
  const splitPath = query.pathname.split('/');
  await (splitPath.length === 5 ? loadBackupDB(splitPath[4], true) : backupDB());
  res.end();
} as ApiHandler);
