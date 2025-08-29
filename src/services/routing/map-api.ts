import { decode, encode } from 'cbor-x'

import { HTTPHandler } from '@/services/routing/types'
import { verifyJWT } from '@/services/session/session'
import {
  APIMappableHandlerMethods,
  APIMappableHandlerOptions,
  APIMappableHandler,
} from '@/sky-shared/api-mappable'

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH'])

export function mapApi<T = undefined>(
  handler: APIMappableHandler<T>,
  editReponse: (
    body: unknown,
    data: APIMappableHandlerOptions<T>,
  ) => unknown = (x) => x,
) {
  return (async (request, response, query, parameters) => {
    const session = await verifyJWT(request.headers.get('session'))
    const data = {
      session,
    } as APIMappableHandlerOptions<T>
    if (BODY_METHODS.has(request.method))
      data.body = decode(await request.bytes())
    data.method = request.method as APIMappableHandlerMethods
    data.query = query
    data.parameters = parameters
    response.body = encode(editReponse(await handler(data), data))
    response.headers.set('content-type', 'application/cbor')
  }) satisfies HTTPHandler
}

export function defaultMapApi<T>(
  idFieldName: string,
  controller: {
    create?: APIMappableHandler<T>
    update?: APIMappableHandler<T>
    get?: APIMappableHandler<T>
    delete?: APIMappableHandler<T>
    getAll?: APIMappableHandler<T>
  },
  editReponse?: (body: unknown, data: APIMappableHandlerOptions<T>) => unknown,
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
  }, editReponse)
}
