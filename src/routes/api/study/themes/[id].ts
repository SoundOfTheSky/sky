import { parseInt } from '@softsky/utils'

import { HTTPHandler } from '@/services/http/types'
import { sessionGuard } from '@/services/session/session'
import { usersThemesTable } from '@/services/study/users-themes'

export default (async function (request, response, route) {
  const payload = await sessionGuard({
    request,
    response,
    permissions: ['STUDY'],
    throw401: true,
  })
  const id = parseInt(route.params.id)
  if (request.method === 'POST')
    usersThemesTable.create({ userId: payload.user.id, themeId: id })
  else if (request.method === 'DELETE')
    usersThemesTable.deleteByIdUser(id, payload.user.id)
} satisfies HTTPHandler)
