/* eslint-disable @typescript-eslint/no-unsafe-return */
import { decode, encode } from 'cbor-x'

import { HTTPHandler } from '@/services/routing/types'
import { getSession } from '@/services/session/session'
import {
  APIMappableHandler,
  APIMappableHandlerMethods,
  APIMappableHandlerOptions,
} from '@/sky-shared/api-mappable'

export function mapApi<T = undefined>(
  handler: APIMappableHandler<T>,
  body: (request: Request) => Promise<T> = async (request) =>
    decode(await request.bytes()),
) {
  return (async (request, response, query, parameters) => {
    const data = {
      session: await getSession(request, response),
    } as APIMappableHandlerOptions<T>
    if (request.method !== 'GET' && request.method !== 'DELETE')
      data.body = body(request)
    data.method = request.method as APIMappableHandlerMethods
    data.query = query
    data.parameters = parameters
    response.body = encode(await handler(data))
  }) satisfies HTTPHandler
}

export function defaultMapApi(controller: {
  create?: APIMappableHandler
  update?: APIMappableHandler
  get?: APIMappableHandler
  delete?: APIMappableHandler
  getAll?: APIMappableHandler
}) {
  return mapApi((data) => {
    switch (data.method) {
      case 'GET': {
        return data.parameters?.id
          ? controller.get?.(data)
          : controller.getAll?.(data)
      }
      case 'POST': {
        return controller.create?.(data)
      }
      case 'PUT': {
        return controller.update?.(data)
      }
      case 'DELETE': {
        return controller.delete?.(data)
      }
    }
  })
}
