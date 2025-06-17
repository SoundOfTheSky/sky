import fileController from '@/controllers/file.controller'
import { defaultMapApi } from '@/services/routing/map-api'

export const http = defaultMapApi(fileController)
