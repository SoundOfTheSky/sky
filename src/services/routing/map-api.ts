import { decode, encode } from 'cbor-x'

import { HTTPHandler } from '@/services/routing/types'
import { verifyJWT } from '@/services/session/session'
import {
  APIMappableHandlerMethods,
  APIMappableHandlerOptions,
  NotAllowedError,
  APIMappableHandler,
} from '@/sky-shared/api-mappable'

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH'])

export function mapApi<T = undefined>(handler: APIMappableHandler<T>) {
  return (async (request, response, query, parameters) => {
    const session = await verifyJWT(request.headers.get('session'))
    if (!session) throw new NotAllowedError()
    const data = {
      session,
    } as APIMappableHandlerOptions<T>
    if (BODY_METHODS.has(request.method))
      data.body = decode(await request.bytes())
    data.method = request.method as APIMappableHandlerMethods
    data.query = query
    data.parameters = parameters
    response.body = encode(await handler(data))
  }) satisfies HTTPHandler
}

export function defaultMapApi(
  idFieldName: string,
  controller: {
    create?: APIMappableHandler
    update?: APIMappableHandler
    get?: APIMappableHandler
    delete?: APIMappableHandler
    getAll?: APIMappableHandler
  },
) {
  return mapApi((data) => {
    switch (data.method) {
      case 'GET': {
        return data.parameters?.[idFieldName]
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
