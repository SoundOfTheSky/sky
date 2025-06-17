import { MongoDatabaseConnector } from '@/services/database'
import { User, UserService } from '@/sky-shared/user.service'

export const UserDatabase = new MongoDatabaseConnector<User>('files')

export const userService = new (class extends UserService {
  public me(_id: string): Promise<User | undefined> {
    return UserDatabase.get(_id)
  }
})(UserDatabase)
