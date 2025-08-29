import { password } from 'bun'

import { MongoDatabaseConnector } from '@/services/database'
import { signJWT } from '@/services/session/session'
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
import { assertPermissions } from '@/sky-shared/session'
import { assertType, hasID } from '@/sky-shared/type-checker'

export type BEUser = User & {
  password: string
}

export const UserDatabase = new MongoDatabaseConnector<BEUser>('users')

class BEUserController extends UserController<BEUser> {
  public async create({ body }: APIMappableHandlerOptions): Promise<string> {
    assertType(UserCreateT, body)
    const [exists] = await this.database.getAll({
      'username=': body.username,
    })
    if (exists) {
      if (await Bun.password.verify(body.password, exists.password))
        return this.createToken(exists)
      throw new NotFoundError()
    }
    if (!hasID(body)) throw new NotFoundError()
    await this.database.create({
      _id: body._id,
      username: body.username,
      permissions: [],
      status: UserStatus.DEFAULT,
      updated: body.updated ?? new Date(),
      created: body.created ?? new Date(),
      password: await Bun.password.hash(body.password),
    })
    return this.createToken((await this.database.get(body._id))!)
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
    if (existing._id !== session._id) assertPermissions(session, ['ADMIN'])
    await this.database.update(_id, {
      username: body.username,
      password: await password.hash(body.password),
      updated: body.updated ?? new Date(),
    })
  }

  private createToken(user: User) {
    return signJWT({
      _id: user._id,
      permissions: user.permissions,
      status: user.status,
    }).then((x) => x.access_token)
  }
}

export const userController = new BEUserController(UserDatabase)
