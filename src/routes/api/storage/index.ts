import { HTTPHandler } from '@/services/routing/types'
import { sendCompressedJSON } from '@/services/routing/utilities'
import { getSession } from '@/services/session/session'
import { storageTable } from '@/services/storage/storage'

export default (async (request, response) => {
  if (request.method === 'GET') {
    const session = await getSession({
      request,
      response,
      permissions: ['STORAGE'],
      throw401: true,
    })
    sendCompressedJSON(response, storageTable.getByUserId(session.user.id))
  }
}) satisfies HTTPHandler
