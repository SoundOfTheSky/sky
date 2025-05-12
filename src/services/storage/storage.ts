import { ObjectCamelToSnakeCase } from '@softsky/utils'

import { Query } from '@/services/db/query'
import { DEFAULT_COLUMNS, TableWithUser } from '@/services/db/table'
import TABLES from '@/services/tables'
import { UserStorage, UserStorageDTO } from '@/sky-shared/storage'


export class UserStorageTable extends TableWithUser<
  UserStorage,
  UserStorageDTO,
  Query<ObjectCamelToSnakeCase<UserStorage>>
> {
  private $getByUserId = this.query
    .clone()
    .where<{ userId: number }>('user_id = $userId')
    .toDBQuery()

  public constructor() {
    super(TABLES.STORAGE, {
      ...DEFAULT_COLUMNS,
      userId: {
        type: 'INTEGER',
        required: true,
        unique: true,
        ref: {
          table: TABLES.USERS,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
      used: {
        type: 'INTEGER',
        required: true,
      },
      capacity: {
        type: 'INTEGER',
        required: true,
      },
    })
  }

  public getByUserId(userId: number) {
    return this.convertFrom(this.$getByUserId.get({ userId }))
  }
}
export const storageTable = new UserStorageTable()
