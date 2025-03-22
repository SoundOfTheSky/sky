import { HTTPHandler } from '@/services/http/types'
import { HTTPError } from '@/services/http/utils'
import { sessionGuard, setAuth, signJWT } from '@/services/session/session'

export default (async function (request, response) {
  const payload = await sessionGuard({ request, response })
  if (!payload.user) throw new HTTPError('Not logged in', 401)
  delete payload.user
  setAuth(
    response,
    await signJWT(
      {
        ...payload,
      },
      {
        expiresIn: ~~(payload.exp - Date.now() / 1000),
      },
    ),
  )
} satisfies HTTPHandler)
