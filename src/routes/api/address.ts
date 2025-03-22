import { ValidationError } from '@softsky/utils'

import { HTTPHandler } from '@/services/http/types'

export default (async function (request, response) {
  const data = server!.requestIP(request)
  if (!data) throw new ValidationError('Unknown IP')
  response.headers.set('Content-Type', 'application/json')
  data.address = '193.93.237.23'
  response.body = await fetch(
    `http://ip-api.com/json/${data.address}?fields=131289`,
  ).then((x) => x.text())
} satisfies HTTPHandler)
