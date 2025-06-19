import { ValidationError } from '@softsky/utils'
import { password } from 'bun'

import { MongoDatabaseConnector } from '@/services/database'
import {
  APIMappableHandlerOptions,
  NotFoundError,
} from '@/sky-shared/api-mappable'
import {
  User,
  UserController,
  UserStatus,
  UserCreateT,
} from '@/sky-shared/controllers/user.controller'
import { getDefaultFields } from '@/sky-shared/database'
import { assertPermissions } from '@/sky-shared/session'
import { assertType, hasID } from '@/sky-shared/type-checker'

export type BEUser = User & {
  password: string
}

export const UserDatabase = new MongoDatabaseConnector<BEUser>('users')

class BEUserController extends UserController<BEUser> {
  public async create({ body }: APIMappableHandlerOptions): Promise<User> {
    assertType(UserCreateT, body)
    const [exists] = await this.database.getAll({
      'username=': body.username,
    })
    if (exists) {
      if (await Bun.password.verify(body.password, exists.password))
        return exists
      throw new NotFoundError()
    }
    if (!hasID(body)) throw new ValidationError()
    await this.database.create({
      ...getDefaultFields(),
      _id: body._id,
      username: body.username,
      permissions: [],
      status: UserStatus.DEFAULT,
      password: await Bun.password.hash(body.password),
    })
    return this.database.get(body._id) as Promise<User>
  }

  public async update({
    parameters,
    session,
    body,
  }: APIMappableHandlerOptions) {
    assertPermissions(session)
    const _id = parameters?.user
    if (!_id) throw new NotFoundError()
    assertType(UserCreateT, body)
    const existing = await this.database.get(_id)
    if (!existing) throw new NotFoundError()
    if (existing._id !== session.user._id) assertPermissions(session, ['ADMIN'])
    await this.database.update(_id, {
      username: body.username,
      password: await password.hash(body.password),
    })
  }
}

export const userController = new BEUserController(UserDatabase)
