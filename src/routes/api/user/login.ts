import { HTTPHandler } from '@/services/routing/types'
import { getRequestBody, HTTPError } from '@/services/routing/utilities'
import { getSession, setAuth, signJWT } from '@/services/session/session'
import { usersTable } from '@/services/session/users'

export default (async function (request, response) {
  if (request.method !== 'POST') return
  const [payload, body] = await Promise.all([
    getSession({ request, response }),
    getRequestBody(request, LoginT),
  ])
  const user = usersTable.convertFrom(usersTable.$getByUsername.get(body))
  if (!user || !(await Bun.password.verify(body.password, user.password)))
    throw new HTTPError('Not found', 404)
  setAuth(
    response,
    await signJWT(
      {
        ...payload,
        user: {
          id: user.id,
          permissions: user.permissions,
          status: user.status,
        },
      },
      {
        expiresIn: ~~(payload.exp - Date.now() / 1000),
      },
    ),
  )
  response.body = ''
} satisfies HTTPHandler)
