/* eslint-disable @typescript-eslint/ban-types */
import { Statement } from 'bun:sqlite';

import { TSchema } from '@sinclair/typebox';
import { TypeCheck } from '@sinclair/typebox/compiler';

import { Query } from '@/services/db/query';
import { Table, TableWithUser } from '@/services/db/table';
import { DBRow, TableDTO } from '@/services/db/types';
import { HTTPHandler } from '@/services/http/types';
import { HTTPError, sendCompressedJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { TableDefaults } from '@/sky-shared/db';
import { parseInt } from '@/sky-utils';

const QUERY_MODIFIERS = {
  '<': '<',
  '>': '>',
  '!': '<>',
  '~': 'LIKE',
} as const;

const queryCache = new Map<string, Statement<DBRow, [{}]>>();
/**
 * Parses queries
 * - key=value - Search for exact value
 * - key!=value - Search without this value
 * - key~=value - Search for substring. Accepts %
 * - key<=value - Less or equal
 * - key>=value - More or equal
 */
function queryWhere<
  OUTPUT extends TableDefaults = TableDefaults,
  INPUT extends object = TableDTO<OUTPUT>,
  QUERY extends Query<TableDefaults> = Query<TableDefaults, TableDefaults, undefined>,
>(table: Table<OUTPUT, INPUT, QUERY>, query: Record<string, string> = {}): OUTPUT[] {
  const params: DBRow = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let where = '';
  for (const key of Object.keys(query)) {
    const modifier = QUERY_MODIFIERS[key.at(-1) as keyof typeof QUERY_MODIFIERS];
    const tableColumnName = modifier ? key.slice(0, -1) : key;
    const column = table.schema.get(tableColumnName);
    if (!column) continue;
    where += ` AND ${tableColumnName} ${modifier} $${tableColumnName}`;
    switch (column.type) {
      case 'INTEGER':
        params[key] = parseInt(query[key]);
        break;
      case 'REAL':
        params[key] = parseFloat(query[key]);
        break;
      default:
        params[key] = query[key];
        break;
    }
  }
  const cacheKey = table.name + Object.keys(query).join(',');
  let cachedQuery = queryCache.get(cacheKey);
  if (!cachedQuery) {
    cachedQuery = table.query.clone().where(where).toDBQuery();
    queryCache.set(cacheKey, cachedQuery);
  }
  return table.convertFromMany(cachedQuery.all(params));
}

export class RESTApi<
  OUTPUT extends TableDefaults = TableDefaults,
  INPUT extends object = TableDTO<OUTPUT>,
  QUERY extends Query<TableDefaults> = Query<TableDefaults, TableDefaults, undefined>,
> {
  public constructor(public table: Table<OUTPUT, INPUT, QUERY>) {}

  public getAll(params: Record<string, string>): OUTPUT[] {
    return queryWhere(this.table, params);
  }

  public get(params: { id: number }): OUTPUT | undefined {
    return this.table.getById(params.id);
  }

  public create(data: INPUT): OUTPUT {
    const changes = this.table.create(data);
    return this.get({ id: changes.lastInsertRowid as number })!;
  }

  public update(id: number, data: INPUT): OUTPUT {
    const changes = this.table.update(id, data);
    return this.get({ id: changes.lastInsertRowid as number })!;
  }

  public delete(params: { id: number }): void {
    this.table.deleteById(params.id);
  }
}

export class RESTApiUser<
  OUTPUT extends TableDefaults & { userId: number } = TableDefaults & { userId: number },
  INPUT extends object = TableDTO<OUTPUT>,
  QUERY extends Query<TableDefaults & { user_id: number }> = Query<TableDefaults & { user_id: number }>,
> extends RESTApi<OUTPUT, INPUT, QUERY> {
  public declare table: TableWithUser<OUTPUT, INPUT, QUERY>;

  public get(params: { id: number; user_id: number }): OUTPUT | undefined {
    return this.table.getByIdUser(params.id, params.user_id);
  }

  public delete(params: { id: number; user_id: number }): void {
    this.table.deleteByIdUser(params.id, params.user_id);
  }
}

export function createRestEndpointHandler(
  api: RESTApi,
  T: TypeCheck<TSchema>,
  viewPermission: string,
  editPermission: string,
): HTTPHandler {
  return async (req, res, route) => {
    const session = await sessionGuard({
      req,
      res,
      permissions: [req.method === 'GET' ? viewPermission : editPermission],
      throw401: true,
    });
    const param = route.params['id'];
    switch (req.method) {
      case 'GET':
        if (param) {
          const item = api.get({
            id: parseInt(param),
            user_id: session.user.id,
          } as never);
          if (!item) throw new HTTPError('Not found', 404);
          sendCompressedJSON(res, item);
        } else {
          route.query.user_id = session.user.id.toString();
          sendCompressedJSON(res, api.getAll(route.query));
        }
        break;
      case 'DELETE':
        api.delete({
          id: parseInt(param),
          user_id: session.user.id,
        } as never);
        break;
      case 'POST':
        const body = (await req.json()) as { user_id: number };
        if (!T.Check(body)) throw new HTTPError('Validation error', 400, JSON.stringify([...T.Errors(body)]));
        body['user_id'] = session.user.id;
        if (param) sendCompressedJSON(res, api.update(parseInt(param), body));
        else sendCompressedJSON(res, api.create(body));
        break;
    }
  };
}
