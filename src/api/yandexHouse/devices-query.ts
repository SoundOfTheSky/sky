import { authCheck, PERMISSIONS } from '../../services/auth';
import { DeviceState, deviceStates } from '../../devices';
import { getDataFromRequest, sendJSON } from '../../utils';
import type { ApiHandler } from '..';
export default (async function (req, res, query) {
  if (query.pathname !== '/api/yandex-house/v1.0/user/devices/query') return;
  const rawData = await getDataFromRequest(req);
  const data = rawData.toString();
  if (!authCheck(req, res, [PERMISSIONS.HOUSE])) return;
  const state = (
    JSON.parse(data) as {
      devices: { id: string }[];
    }
  ).devices
    .map((d) => deviceStates.get(d.id))
    .filter(Boolean) as DeviceState[];
  sendJSON(res, {
    request_id: req.headers['x-request-id'],
    payload: {
      devices: state,
    },
  });
} as ApiHandler);
