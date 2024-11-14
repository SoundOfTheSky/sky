import { HTTPHandler } from '@/services/http/types'
import { sessionGuard } from '@/services/session'
import { reloadStatic } from '@/services/static'

export default (async function (request) {
  await sessionGuard({ request, permissions: ['ADMIN'], throw401: true })
  await reloadStatic()
} satisfies HTTPHandler)
