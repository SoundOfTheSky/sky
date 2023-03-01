import { sendRedirect } from '../../utils';
import type { ApiHandler } from '..';
export default (function (_req, res, query) {
  if (query.pathname !== '/api/yandex-house/auth') return;
  sendRedirect(
    res,
    query.searchParams.get('redirect_uri')! +
      `?code=1488&state=${query.searchParams.get('state')!}&client_id=${query.searchParams.get(
        'client_id',
      )!}&scope=${query.searchParams.get('scope')!}`,
  );
} as ApiHandler);
