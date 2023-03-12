import { getDataFromRequest, sendJSON, setCookie, ValidationError } from '../../utils';
import type { ApiHandler } from '..';
import { PERMISSIONS, sign } from '../../services/auth';

export default (async function (req, res, query) {
  if (query.pathname !== '/api/yandex-house/token' || req.method !== 'POST') return;
  const rawData = await getDataFromRequest(req);
  const data = rawData.toString();
  if (!data) throw new ValidationError('Invalid data');
  const body = Object.fromEntries(data.split('&').map((x) => x.split('='))) as Record<string, string>;
  if (body['client_id'] !== 'yandex' || body['client_secret'] !== process.env['YANDEX_HOUSE_SECRET']) {
    res.writeHead(401).end();
    return;
  }
  const resBody = sign(
    {
      permissions: [PERMISSIONS.HOUSE],
      id: -1,
      status: 0,
    },
    {
      expiresIn: 4_294_967_295,
    },
  );
  setCookie(
    res,
    'Authorization',
    `${resBody.token_type} ${resBody.access_token}; Max-Age=${resBody.expires_in}; Secure; HttpOnly`,
  );
  sendJSON(res, resBody);
} as ApiHandler);
