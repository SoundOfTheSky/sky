import { HTTPHandler } from '@/services/http/types'
import { sendCompressedJSON } from '@/services/http/utils'
import { sessionGuard } from '@/services/session/session'
import { storageTable } from '@/services/storage/storage'

export default (async (request, response) => {
  if (request.method === 'GET') {
    const session = await sessionGuard({
      request,
      response,
      permissions: ['STORAGE'],
      throw401: true,
    })
    sendCompressedJSON(response, storageTable.getByUserId(session.user.id))
  }
}) satisfies HTTPHandler
