import { HTTPHandler } from '@/services/http/types'
import { HTTPError } from '@/services/http/utilities'
import { getStaticFileWithIndexFallback } from '@/services/static'

export default (async function (request, response, router) {
  if (router.pathname.startsWith('/api/')) throw new HTTPError('Not found', 404)
  const file = await getStaticFileWithIndexFallback(
    router.pathname,
    request.headers.get('accept-encoding')?.includes('br'),
  )
  if (!file) throw new HTTPError('Not found', 404)
  // Static is unchangeable, cache for a year (max val)
  if (router.pathname.startsWith('/static/'))
    response.headers.set('cache-control', 'public, max-age=31536000, immutable')
  // Don't cache html files, otherswise cache for a week
  else if (!file.type.startsWith('text/html'))
    response.headers.set('cache-control', 'public, max-age=604800, immutable')
  response.body = file
  response.headers.set('content-type', file.type)
  response.headers.set('content-length', file.size.toString())
  if (file.name!.endsWith('.br')) response.headers.set('content-encoding', 'br')
} satisfies HTTPHandler)
