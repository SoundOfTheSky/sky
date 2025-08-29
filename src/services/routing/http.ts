import { formatNumber, log, ValidationError } from '@softsky/utils'

import { http as defaultHandler } from '@/routes'
import { getRoute } from '@/services/routing/router'
import { HTTPResponse } from '@/services/routing/types'
import { HTTPError } from '@/services/routing/utilities'
import { NotAllowedError, NotFoundError } from '@/sky-shared/api-mappable'

export async function handleHTTP(
  request: Request,
): Promise<Response | undefined> {
  const url = request.url.slice(request.url.indexOf('/', 8))
  log(`[HTTP] ${request.method}: ${request.url}`)
  const time = Date.now()
  const response: HTTPResponse = {
    headers: new Headers(),
  }
  response.headers.set(
    'cache-control',
    'no-cache, no-store, max-age=0, must-revalidate',
  )
  const { handler, query, parameters } = getRoute(url)
  try {
    await (handler.http
      ? handler.http(request, response, query, parameters)
      : defaultHandler(request, response, query, parameters))
  } catch (error) {
    if (error instanceof HTTPError) {
      response.status = error.code
      response.body = error.body
    } else if (error instanceof NotFoundError) {
      response.status = 404
      response.body = error.message
    } else if (error instanceof NotAllowedError) {
      response.status = 401
      response.body = error.message
    } else if (error instanceof ValidationError) {
      response.status = 400
      response.body = error.message
    } else {
      response.status = 500
      console.error(error)
    }
  }
  log(
    `[HTTP END] ${request.method}: ${request.url} ${formatNumber(Date.now() - time)}`,
  )
  return new Response(response.body as globalThis.BodyInit, response)
}
