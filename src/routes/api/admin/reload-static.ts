import { HTTPHandler } from '@/services/routing/types'
import { getSession } from '@/services/session/session'
import { reloadStatic } from '@/services/static'

export default (async function (request) {
  await getSession({ request, permissions: ['ADMIN'], throw401: true })
  await reloadStatic()
} satisfies HTTPHandler)
