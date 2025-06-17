import { TObject } from '@sinclair/typebox'
import { TypeCheck } from '@sinclair/typebox/compiler'
import { ValidationError } from '@softsky/utils'
import { encode } from 'cbor-x'

import { MongoDatabaseConnector } from '@/services/database'
import { HTTPResponse, WS } from '@/services/routing/types'
import { getRequestBody, sendBody } from '@/services/routing/utilities'
import { getSession } from '@/services/session/session'
import { DefaultSchema, QueryKeys } from '@/sky-shared/database'
import {
  WebSocketMessageClient,
  WebSocketMessageSubscribeValue,
  WebSocketMessageType,
} from '@/sky-shared/web-socket'

export enum EndpointRequestType {
  DEFAULT,
  GET,
  GET_ALL,
  UPDATE,
  UPDATE_MANY,
  CREATE,
  CREATE_MANY,
  DELETE,
  DELETE_MANY,
  CURSOR,
}
export class Endpoint<T extends DefaultSchema> {
  public constructor(
    protected database: MongoDatabaseConnector<T>,
    protected T: TypeCheck<TObject>,
    public permissions: Partial<Record<EndpointRequestType, string[]>> = {},
  ) {}

  protected getPermission(type: EndpointRequestType) {
    const permissions = []
    const a = this.permissions[EndpointRequestType.DEFAULT]
    const b = this.permissions[type]
    if (a) permissions.push(...a)
    if (b) permissions.push(...b)
    return permissions
  }

  public async http(
    request: Request,
    response: HTTPResponse,
    query: Record<string, string>,
    parameters: Record<string, string>,
  ) {
    switch (request.method) {
      case 'POST': {
        const body = (await getRequestBody(request, this.T)) as T | T[]
        await getSession({
          request,
          response,
          permissions: this.getPermission(
            Array.isArray(body)
              ? EndpointRequestType.CREATE_MANY
              : EndpointRequestType.CREATE,
          ),
        })
        await (Array.isArray(body)
          ? this.database.createMany(body)
          : this.database.create(body))
        break
      }
      case 'PUT': {
        await getSession({
          request,
          response,
          permissions: this.getPermission(
            parameters.data
              ? EndpointRequestType.UPDATE
              : EndpointRequestType.UPDATE_MANY,
          ),
        })
        const body = (await getRequestBody(request, this.T)) as Partial<T>
        await (parameters.data
          ? this.database.update(parameters.data, body)
          : this.database.updateMany(query as QueryKeys<T>, body))
        break
      }
      case 'DELETE': {
        await getSession({
          request,
          response,
          permissions: this.getPermission(
            parameters.data
              ? EndpointRequestType.DELETE
              : EndpointRequestType.DELETE_MANY,
          ),
        })
        await (parameters.data
          ? this.database.delete(parameters.data)
          : this.database.deleteMany(query as QueryKeys<T>))
        break
      }
      default: {
        await getSession({
          request,
          response,
          permissions: this.getPermission(
            parameters.data
              ? EndpointRequestType.GET
              : EndpointRequestType.GET_ALL,
          ),
        })
        sendBody(
          response,
          parameters.data
            ? this.database.get(parameters.data)
            : this.database.getAll(query as QueryKeys<T>),
        )
      }
    }
  }

  public async websocket(
    websocket: WS,
    data: WebSocketMessageClient,
    query: Record<string, string>,
  ) {
    if (data.type !== WebSocketMessageType.SUBSCRIBE)
      throw new ValidationError('Not supported')
    const cursor = this.database.cursor(query as QueryKeys<T>)
    while (true) {
      const element = await cursor.next()
      const response: WebSocketMessageSubscribeValue = {
        id: data.id,
        type: WebSocketMessageType.SUBSCRIBE_VALUE,
        value: element.value,
      }
      if (element.done) response.done = true
      websocket.sendBinary(encode(response))
      if (element.done) break
    }
  }
}
