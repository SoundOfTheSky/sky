import { Type } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

import { HTTPHandler } from '@/services/http/types'
import { getRequestBodyT, HTTPError } from '@/services/http/utilities'
import { sessionGuard, setAuth, signJWT } from '@/services/session/session'
import { usersTable } from '@/services/session/users'

export const LoginT = TypeCompiler.Compile(
  Type.Object({
    username: Type.RegExp(/^(?!.*_{2})\w{3,16}$/u),
    password: Type.String({
      minLength: 3,
      maxLength: 32,
    }),
  }),
)

export default (async function (request, response) {
  if (request.method !== 'POST') return
  const [payload, body] = await Promise.all([
    sessionGuard({ request, response }),
    getRequestBodyT(request, LoginT),
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
