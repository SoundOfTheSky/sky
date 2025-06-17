import { UserDatabase } from '@/collections/user.collection'
import { Endpoint } from '@/services/routing/endpoint'
import { UserT } from '@/sky-shared/user.service'

export default new Endpoint(UserDatabase, UserT)
