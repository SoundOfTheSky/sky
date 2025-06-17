import { userService } from '@/collections/user.collection'
import { HTTPHandler } from '@/services/routing/types'
import { sendBody, sendCompressedJSON } from '@/services/routing/utilities'
import { getSession } from '@/services/session/session'

export default (async function (request, response) {
  if (request.method !== 'GET' && request.method !== 'POST') return
  const payload = await getSession({
    request,
    response,
    permissions: [],
    throw401: true,
  })
  const user = await userService.me(payload.user._id)
  if (!user) {
    sendBody(response, undefined)
    return
  }
  delete user.password
  sendCompressedJSON(response, user)
} satisfies HTTPHandler)
