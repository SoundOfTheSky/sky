import { BEUser, userController } from '@/controllers/user.controller'
import { defaultMapApi } from '@/services/routing/map-api'
import { HTTPHandler } from '@/services/routing/types'

export const http: HTTPHandler = defaultMapApi('user', userController, (x) => {
  if (Array.isArray(x))
    for (const item of x) delete (item as Partial<BEUser>).password
  else delete (x as Partial<BEUser>).password
  return x
})
