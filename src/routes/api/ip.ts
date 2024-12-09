import { ValidationError } from '@softsky/utils'

import { HTTPHandler } from '@/services/http/types'

export default (function (request, response) {
  const data = server!.requestIP(request)
  if (!data) throw new ValidationError('Unknown IP')
  response.body = data.address
} satisfies HTTPHandler)
