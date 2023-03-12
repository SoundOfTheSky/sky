import { authCheck, PERMISSIONS } from '../../services/auth';
import { devices } from '../../devices';
import type { ApiHandler } from '..';
export default (function (req, res, query) {
  if (query.pathname !== '/api/yandex-house/v1.0/user/devices') return;
  if (!authCheck(req, res, [PERMISSIONS.HOUSE])) return;
  res.writeHead(200, {
    'Content-Type': 'application/json',
  });
  res.end(
    JSON.stringify({
      request_id: req.headers['x-request-id'],
      payload: {
        user_id: 'Sky',
        devices: [...devices.values()],
      },
    }),
  );
} as ApiHandler);
