import { ValidationError } from '@softsky/utils'

import { LoginT } from '@/routes/api/auth/login'
import { HTTPHandler } from '@/services/http/types'
import { getRequestBodyT } from '@/services/http/utilities'
import { sessionGuard, setAuth, signJWT } from '@/services/session/session'
import { usersTable } from '@/services/session/users'

export default (async function (request, response) {
  if (request.method !== 'POST') return
  const [payload, body] = await Promise.all([
    sessionGuard({ request, response }),
    getRequestBodyT(request, LoginT),
  ])
  if (usersTable.$getByUsername.get(body))
    throw new ValidationError('Username taken')
  const userId = usersTable.create({
    username: body.username,
    password: await Bun.password.hash(body.password),
    status: 0,
    permissions: ['STORAGE'],
  }).lastInsertRowid as number
  setAuth(
    response,
    await signJWT(
      {
        ...payload,
        user: {
          id: userId,
          permissions: ['STORAGE'],
          status: 0,
        },
      },
      {
        expiresIn: ~~(payload.exp - Date.now() / 1000),
      },
    ),
  )
} satisfies HTTPHandler)
