import { userController } from '@/controllers/user.controller'
import { defaultMapApi } from '@/services/routing/map-api'
import { HTTPHandler } from '@/services/routing/types'

export const http: HTTPHandler = defaultMapApi('user', userController)
