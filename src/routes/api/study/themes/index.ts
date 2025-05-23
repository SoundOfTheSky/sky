import { HTTPHandler } from '@/services/http/types'
import { sendCompressedJSON } from '@/services/http/utilities'
import { sessionGuard } from '@/services/session/session'
import { usersThemesTable } from '@/services/study/users-themes'

export default (async (request, response) => {
  const session = await sessionGuard({
    request,
    response,
    permissions: ['STUDY'],
    throw401: true,
  })
  if (request.method === 'GET')
    sendCompressedJSON(
      response,
      usersThemesTable.getThemesData(session.user.id),
    )
}) satisfies HTTPHandler
