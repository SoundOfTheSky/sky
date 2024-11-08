import { Statement } from 'bun:sqlite';

import { TSchema } from '@sinclair/typebox';
import { TypeCheck } from '@sinclair/typebox/compiler';

import { Query } from '@/services/db/query';
import { Table, TableWithUser } from '@/services/db/table';
import { DBDataType, DBRow, TableDTO } from '@/services/db/types';
import { HTTPHandler } from '@/services/http/types';
import { HTTPError, sendCompressedJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { TableDefaults } from '@/sky-shared/db';
import { parseInt } from 'sky-utils';

const QUERY_MODIFIERS = {
  '<': ['<', 'l'],
  '>': ['>', 'g'],
  '!': ['<>', 'n'],
  '~': ['LIKE', 's'],
} as const;

export class RESTApi<
  OUTPUT extends TableDefaults = TableDefaults,
  INPUT extends object = TableDTO<OUTPUT>,
  QUERY extends Query<TableDefaults> = Query<TableDefaults, TableDefaults>,
> {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  protected queryCache = new Map<string, Statement<DBRow, [{}]>>();

  public constructor(
    public table: Table<OUTPUT, INPUT, QUERY>,
    public queryFields: Record<
      string,
      {
        sql: (modifier: string, param: string) => string;
        convertTo: (data: string) => DBDataType;
      }
    > = {},
    public sortableFields: Record<string, string[]> = {},
  ) {}

  public getAll(query: Record<string, string>): OUTPUT[] {
    return this.query(query);
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

  /**
   * Parses queries
   * - key=value - Search for exact value
   * - key!=value - Search without this value
   * - key~=value - Search for substring. Accepts %
   * - key<=value - Less
   * - key>=value - Greater
   * - sort+=column - sort ascending WIP
   * - sort-=column - sort descending WIP
   */
  protected query(query?: Record<string, string>): OUTPUT[] {
    const params: DBRow = {};

    let where = '';
    if (query)
      for (const key in query) {
        let name;
        let modifier = QUERY_MODIFIERS[
          key.at(-1) as keyof typeof QUERY_MODIFIERS
        ] as [string, string] | undefined;
        if (modifier) name = key.slice(0, -1);
        else {
          name = key;
          modifier = ['=', 'e'];
        }
        const field = this.queryFields[name];
        if (!field) continue;
        const param = name + modifier[1];
        where += ` AND ${field.sql(modifier[0], param)}`;
        params[param] = field.convertTo(query[key]!);
      }
    let cachedQuery = this.queryCache.get(where);
    if (!cachedQuery) {
      cachedQuery = this.table.query.clone().where(where.slice(5)).toDBQuery();
      this.queryCache.set(where, cachedQuery);
    }
    return this.table.convertFromMany(cachedQuery.all(params));
  }
}

export class RESTApiUser<
  OUTPUT extends TableDefaults & { userId: number } = TableDefaults & {
    userId: number;
  },
  INPUT extends object = TableDTO<OUTPUT>,
  QUERY extends Query<TableDefaults & { user_id: number }> = Query<
    TableDefaults & { user_id: number }
  >,
> extends RESTApi<OUTPUT, INPUT, QUERY> {
  public declare table: TableWithUser<OUTPUT, INPUT, QUERY>;

  public get(params: { id: number; user_id: number }): OUTPUT | undefined {
    return this.table.getByIdUser(params.id, params.user_id);
  }

  public delete(params: { id: number; user_id: number }): void {
    this.table.deleteByIdUser(params.id, params.user_id);
  }

  public create(data: INPUT): OUTPUT {
    const changes = this.table.create(data);
    return this.get({
      id: changes.lastInsertRowid as number,
      user_id: (data as { user_id: number }).user_id,
    })!;
  }

  public update(id: number, data: INPUT): OUTPUT {
    const changes = this.table.update(id, data);
    return this.get({
      id: changes.lastInsertRowid as number,
      user_id: (data as { user_id: number }).user_id,
    })!;
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
    const param = route.params.id;
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
      case 'POST': {
        const body = (await req.json()) as { user_id: number };
        if (!T.Check(body))
          throw new HTTPError(
            'Validation error',
            400,
            JSON.stringify([...T.Errors(body)]),
          );
        body.user_id = session.user.id;
        sendCompressedJSON(res, api.create(body));
        break;
      }
      case 'PUT': {
        const body = (await req.json()) as { user_id: number };
        if (!T.Check(body))
          throw new HTTPError(
            'Validation error',
            400,
            JSON.stringify([...T.Errors(body)]),
          );
        body.user_id = session.user.id;
        sendCompressedJSON(res, api.update(parseInt(param), body));
        break;
      }
    }
  };
}
