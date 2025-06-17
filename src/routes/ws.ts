import { HTTPHandler } from '@/services/routing/types'
import { getSession } from '@/services/session/session'

export default (async function (request, response) {
  const payload = await getSession({ request, response })
  if (
    !globalThis.server!.upgrade(request, {
      headers: response.headers,
      data: { session: payload },
    })
  )
    throw new Error('Upgrading to WebSocket failed')
} satisfies HTTPHandler)
