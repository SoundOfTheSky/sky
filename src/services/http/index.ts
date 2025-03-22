import Path from 'node:path'

import { ValidationError, formatNumber, log } from '@softsky/utils'
import { FileSystemRouter, Server } from 'bun'

import { HTTPHandler, HTTPResponse } from '@/services/http/types'
import { HTTPError } from '@/services/http/utils'
import { sessionGuard } from '@/services/session/session'

const router = new FileSystemRouter({
  style: 'nextjs',
  dir: Path.join(import.meta.dir, '../../routes'),
  origin: import.meta.dir,
})

log('[Loading] Handlers...')
const handlers = new Map(
  await Promise.all(
    Object.entries(router.routes).map(
      async ([key, value]) =>
        [
          key,
          (
            (await import(Path.relative(import.meta.dir, value))) as {
              default: HTTPHandler
            }
          ).default,
        ] as const,
    ),
  ),
)
log('[Loading] Handlers ok!')
export default async function handleHTTP(
  request: Request,
  server: Server,
): Promise<Response | undefined> {
  const url = request.url.slice(request.url.indexOf('/', 8))
  log(`[HTTP] ${request.method}: ${request.url}`)
  const time = Date.now()
  const response: HTTPResponse = {
    headers: new Headers(), // wtf
  }
  response.headers.set(
    'cache-control',
    'no-cache, no-store, max-age=0, must-revalidate',
  )
  if (url === '/ws') {
    const payload = await sessionGuard({ request, response })
    if (
      server.upgrade(request, {
        headers: response.headers,
        data: { jwt: payload },
      })
    )
      return
    return new Response('Upgrading to WebSocket failed', { status: 500 })
  }
  const routerResult = router.match(url)!
  const handler = handlers.get(routerResult.name)!
  try {
    await handler(request, response, routerResult)
  } catch (error) {
    if (error instanceof HTTPError) {
      response.status = error.code
      response.body = error.body
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
