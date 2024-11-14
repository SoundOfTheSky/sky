import { HTTPHandler } from '@/services/http/types'
import { sessionGuard } from '@/services/session'

import { backupDB } from 'services/db/database'

export default (async function (request) {
  await sessionGuard({ request, permissions: ['ADMIN'], throw401: true })
  await backupDB()
} satisfies HTTPHandler)
