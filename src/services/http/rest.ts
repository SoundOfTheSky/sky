/* eslint-disable @typescript-eslint/require-await */
import { TSchema } from '@sinclair/typebox'
import { TypeCheck } from '@sinclair/typebox/compiler'
import { log, objectMap, parseInt, pushToSorted } from '@softsky/utils'
import { Statement } from 'bun:sqlite'

import { Query } from '@/services/db/query'
import { Table, TableWithUser } from '@/services/db/table'
import { DBDataType, DBRow, TableDTO } from '@/services/db/types'
import { HTTPHandler } from '@/services/http/types'
import { HTTPError, sendCompressedJSON } from '@/services/http/utils'
import { sessionGuard } from '@/services/session/session'
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

  public async getAll(query: Record<string, string>): Promise<OUTPUT[]> {
    return this.query(query)
  }

  public async get(parameters: { id: number }): Promise<OUTPUT | undefined> {
    return this.table.getById(parameters.id)
  }

  public async create(data: INPUT): Promise<OUTPUT> {
    const changes = this.table.create(data)
    return this.get({
      id: changes.lastInsertRowid as number,
    }) as Promise<OUTPUT>
  }

  public async update(id: number, data: INPUT): Promise<OUTPUT> {
    const changes = this.table.update(id, data)
    return this.get({
      id: changes.lastInsertRowid as number,
    }) as Promise<OUTPUT>
  }

  public async delete(parameters: { id: number }): Promise<void> {
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
    const cachedKey: string[] = []
    const sort: { field: string; desc: boolean }[] = []
    let where = ''
    if (query)
      for (const key in query) {
        const isDescSort = key === 'sort-'
        if (key === 'sort+' || isDescSort) {
          const fieldsString = query[key]!
          const toPush = key + '=' + fieldsString
          pushToSorted(
            cachedKey,
            toPush,
            (element) => toPush.localeCompare(element) < 0,
          )
          const split = fieldsString.split(',')
          for (let index = 0; index < split.length; index++) {
            const fields = this.sortableFields[split[index]!] ?? []
            for (let index = 0; index < fields.length; index++)
              sort.push({
                field: fields[index]!,
                desc: isDescSort,
              })
          }
          continue
        }
        let name
        const queryModifierKey = key.at(-1) as keyof typeof QUERY_MODIFIERS
        let modifier = QUERY_MODIFIERS[queryModifierKey] as
          | [string, string]
          | undefined
        if (modifier) name = key.slice(0, -1)
        else {
          name = key
          modifier = ['=', 'e']
        }
        const field = this.queryFields[name]
        if (!field) continue
        const parameter = name + modifier[1]
        const sql = field.sql(modifier[0], parameter)
        where += ' AND ' + sql
        parameters[parameter] = field.convertTo(query[key]!)
        pushToSorted(
          cachedKey,
          sql,
          (element) => sql.localeCompare(element) < 0,
        )
      }
    where = where.slice(5)
    const cachedKeyString = cachedKey.join(' ')
    let cachedQuery = this.queryCache.get(cachedKeyString)
    if (!cachedQuery) {
      const tableQuery = this.table.query.clone()
      if (where) tableQuery.where(where)
      for (let index = 0; index < sort.length; index++) {
        const { field, desc } = sort[index]!
        tableQuery.sort(field, desc)
      }
      cachedQuery = tableQuery.toDBQuery()
      log(`[SQL] ${cachedQuery.toString()}`)
      this.queryCache.set(cachedKeyString, cachedQuery)
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
  declare public table: TableWithUser<OUTPUT, INPUT, QUERY>

  public async get(parameters: {
    id: number
    user_id: number
  }): Promise<OUTPUT | undefined> {
    return this.table.getByIdUser(parameters.id, parameters.user_id)
  }

  public async delete(parameters: {
    id: number
    user_id: number
  }): Promise<void> {
    this.table.deleteByIdUser(parameters.id, parameters.user_id)
  }

  public async create(data: INPUT): Promise<OUTPUT> {
    const changes = this.table.create(data)
    return this.get({
      id: changes.lastInsertRowid as number,
      user_id: (data as { user_id: number }).user_id,
    }) as Promise<OUTPUT>
  }

  public async update(id: number, data: INPUT): Promise<OUTPUT> {
    const changes = this.table.update(id, data)
    return this.get({
      id: changes.lastInsertRowid as number,
      user_id: (data as { user_id: number }).user_id,
    }) as Promise<OUTPUT>
  }
}
async function getRestBody(
  request: Request,
  T: TypeCheck<TSchema>,
): Promise<{ user_id: number }> {
  const body = (await request.json()) as { user_id: number }
  if (!T.Check(body))
    throw new HTTPError(
      'Validation error',
      400,
      JSON.stringify([...T.Errors(body)]),
    )
  return objectMap(body, (key, value) => [
    key,
    value === undefined ? null : value,
  ]) as { user_id: number }
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
          const item = await api.get({
            id: parseInt(parameter),
            user_id: session.user.id,
          } as never)
          if (!item) throw new HTTPError('Not found', 404)
          sendCompressedJSON(response, item)
        } else {
          route.query.user_id = session.user.id.toString()
          sendCompressedJSON(response, await api.getAll(route.query))
        }
        break
      }
      case 'DELETE': {
        await api.delete({
          id: parseInt(parameter),
          user_id: session.user.id,
        } as never)
        break
      }
      case 'POST': {
        const body = await getRestBody(request, T)
        body.user_id = session.user.id
        const a = await api.create(body)
        sendCompressedJSON(response, a)
        break
      }
      case 'PUT': {
        const body = await getRestBody(request, T)
        body.user_id = session.user.id
        sendCompressedJSON(
          response,
          await api.update(parseInt(parameter), body),
        )
        break
      }
    }
  }
}
