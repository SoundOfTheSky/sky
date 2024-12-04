import { TSchema } from '@sinclair/typebox'
import { TypeCheck } from '@sinclair/typebox/compiler'
import { objectMap, parseInt } from '@softsky/utils'
import { Statement } from 'bun:sqlite'

import { Query } from '@/services/db/query'
import { Table, TableWithUser } from '@/services/db/table'
import { DBDataType, DBRow, TableDTO } from '@/services/db/types'
import { HTTPHandler } from '@/services/http/types'
import { HTTPError, sendCompressedJSON } from '@/services/http/utils'
import { sessionGuard } from '@/services/session'
import { TableDefaults } from '@/sky-shared/database'

const QUERY_MODIFIERS = {
  '<': ['<', 'l'],
  '>': ['>', 'g'],
  '!': ['<>', 'n'],
  '~': ['LIKE', 's'],
} as const

export class RESTApi<
  OUTPUT extends TableDefaults = TableDefaults,
  INPUT extends object = TableDTO<OUTPUT>,
  QUERY extends Query<TableDefaults> = Query<TableDefaults, TableDefaults>,
> {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  protected queryCache = new Map<string, Statement<DBRow, [{}]>>()

  public constructor(
    public table: Table<OUTPUT, INPUT, QUERY>,
    public queryFields: Record<
      string,
      {
        sql: (modifier: string, parameter: string) => string
        convertTo: (data: string) => DBDataType
      }
    > = {},
    public sortableFields: Record<string, string[]> = {},
  ) {}

  public getAll(query: Record<string, string>): OUTPUT[] {
    return this.query(query)
  }

  public get(parameters: { id: number }): OUTPUT | undefined {
    return this.table.getById(parameters.id)
  }

  public create(data: INPUT): OUTPUT {
    const changes = this.table.create(data)
    return this.get({ id: changes.lastInsertRowid as number })!
  }

  public update(id: number, data: INPUT): OUTPUT {
    const changes = this.table.update(id, data)
    return this.get({ id: changes.lastInsertRowid as number })!
  }

  public delete(parameters: { id: number }): void {
    this.table.deleteById(parameters.id)
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
    const parameters: DBRow = {}

    let where = ''
    if (query)
      for (const key in query) {
        let name
        let modifier = QUERY_MODIFIERS[
          key.at(-1) as keyof typeof QUERY_MODIFIERS
        ] as [string, string] | undefined
        if (modifier) name = key.slice(0, -1)
        else {
          name = key
          modifier = ['=', 'e']
        }
        const field = this.queryFields[name]
        if (!field) continue
        const parameter = name + modifier[1]
        where += ` AND ${field.sql(modifier[0], parameter)}`
        parameters[parameter] = field.convertTo(query[key]!)
      }
    let cachedQuery = this.queryCache.get(where)
    if (!cachedQuery) {
      cachedQuery = this.table.query.clone().where(where.slice(5)).toDBQuery()
      this.queryCache.set(where, cachedQuery)
    }
    return this.table.convertFromMany(cachedQuery.all(parameters))
  }
}

export class RESTApiUser<
  OUTPUT extends TableDefaults & { userId: number } = TableDefaults & {
    userId: number
  },
  INPUT extends object = TableDTO<OUTPUT>,
  QUERY extends Query<TableDefaults & { user_id: number }> = Query<
    TableDefaults & { user_id: number }
  >,
> extends RESTApi<OUTPUT, INPUT, QUERY> {
  public declare table: TableWithUser<OUTPUT, INPUT, QUERY>

  public get(parameters: { id: number, user_id: number }): OUTPUT | undefined {
    return this.table.getByIdUser(parameters.id, parameters.user_id)
  }

  public delete(parameters: { id: number, user_id: number }): void {
    this.table.deleteByIdUser(parameters.id, parameters.user_id)
  }

  public create(data: INPUT): OUTPUT {
    const changes = this.table.create(data)
    return this.get({
      id: changes.lastInsertRowid as number,
      user_id: (data as { user_id: number }).user_id,
    })!
  }

  public update(id: number, data: INPUT): OUTPUT {
    const changes = this.table.update(id, data)
    return this.get({
      id: changes.lastInsertRowid as number,
      user_id: (data as { user_id: number }).user_id,
    })!
  }
}
async function getRestBody(request: Request, T: TypeCheck<TSchema>): Promise<{ user_id: number }> {
  const body = (await request.json()) as { user_id: number }
  if (!T.Check(body))
    throw new HTTPError(
      'Validation error',
      400,
      JSON.stringify([...T.Errors(body)]),
    )
  return objectMap(body, (key, value) => [key, value === undefined ? null : value]) as { user_id: number }
}
export function createRestEndpointHandler(
  api: RESTApi,
  T: TypeCheck<TSchema>,
  viewPermission: string,
  editPermission: string,
): HTTPHandler {
  return async (request, response, route) => {
    const session = await sessionGuard({
      request,
      response,
      permissions: [request.method === 'GET' ? viewPermission : editPermission],
      throw401: true,
    })
    const parameter = route.params.id
    switch (request.method) {
      case 'GET': {
        if (parameter) {
          const item = api.get({
            id: parseInt(parameter),
            user_id: session.user.id,
          } as never)
          if (!item) throw new HTTPError('Not found', 404)
          sendCompressedJSON(response, item)
        }
        else {
          route.query.user_id = session.user.id.toString()
          sendCompressedJSON(response, api.getAll(route.query))
        }
        break
      }
      case 'DELETE': {
        api.delete({
          id: parseInt(parameter),
          user_id: session.user.id,
        } as never)
        break
      }
      case 'POST': {
        const body = await getRestBody(request, T)
        body.user_id = session.user.id
        sendCompressedJSON(response, api.create(body))
        break
      }
      case 'PUT': {
        const body = await getRestBody(request, T)
        body.user_id = session.user.id
        sendCompressedJSON(response, api.update(parseInt(parameter), body))
        break
      }
    }
  }
}
