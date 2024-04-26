import { DB, DBTable } from '@/services/db';
import { HTTPHandler } from '@/services/http/types';
import { HTTPError, sendJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { PERMISSIONS } from '@/services/session/user';

type Action = {
  enabled: boolean;
  permissions?: PERMISSIONS[];
};
export default function createRestEndpointHandler<T, DTO>(
  table: DBTable<T, DTO>,
  options: Action & {
    GET?: Action;
    DELETE?: Action;
    POST?: Action;
    PATCH?: Action;
    PUT?: Action;
  },
): HTTPHandler {
  return async (req, res, route) => {
    const methodOptions = options[req.method as 'GET'];
    if (!options.enabled && !methodOptions?.enabled) throw new HTTPError('Method now allowed', 405);
    let body: unknown;
    // Only Post, Patch and Put has body
    if (req.method[0] === 'P') body = (await req.json()) as unknown;
    const permissions = methodOptions?.permissions ?? options?.permissions;
    const payload = permissions ? await sessionGuard({ req, res, permissions, throw401: true }) : undefined;
    switch (req.method) {
      case 'GET':
        const limit = Math.max(0, Math.min(200, Number.parseInt(route.query['limit'] ?? '200')));
        const offset = Math.max(0, Number.parseInt(route.query['offset'] ?? '200'));
        if (Number.isNaN(limit) || Number.isNaN(offset)) throw new HTTPError('Limit & offset must be integers', 401);
        sendJSON(
          res,
          DB.prepare(`SELECT * FROM ${table.name} LIMIT ? OFFSET ?`)
            .all(limit, offset)
            .map((x) => table.convertFrom(x)),
        );
        break;
      case 'DELETE':
      case 'POST':
      case 'PATCH':
      case 'PUT':
        break;
    }
  };
}
