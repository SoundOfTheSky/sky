import { validateOrReject } from 'class-validator'
import { GraphQLError } from 'graphql'

import { LoginInput, UserModel } from '@/collections/user.collection'
import type { Context } from '@/context'
import { signJWT, verifyJWT } from '@/services/session.service'

export default class UserService {
  public async login(input: LoginInput) {
    await validateOrReject(input)
    const user = await UserModel.findOne({ username: input.username })
    if (!user || !(await Bun.password.verify(input.password, user.password)))
      throw new GraphQLError('NO_FOUND')
    const token = await signJWT({
      user: {
        _id: user._id,
        permissions: user.permissions,
        status: user.status,
      },
    })
    return { token }
  }

  public async register(input: LoginInput) {
    await validateOrReject(input)
    UserModel.find()
    let user = await UserModel.find().findByUsername(input.username)
    if (user) throw new GraphQLError('ALREADY_EXISTS')
    user = await UserModel.create({
      password: await Bun.password.hash(input.password),
      username: input.username,
    })
    const token = await signJWT({
      user: {
        _id: user._id,
        permissions: user.permissions,
        status: user.status,
      },
    })
    return { token }
  }

  public async me(context: Context) {
    const payload = await verifyJWT(context.token)
    if (!payload?.user?.id) throw new GraphQLError('NOT_LOGGED_IN')
    const user = await UserModel.findOne({ _id: payload.user.id }).lean()
    if (!user) throw new GraphQLError('NOT_LOGGED_IN')
    return { token: context.token }
  }
}
