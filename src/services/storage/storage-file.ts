import { ObjectCamelToSnakeCase } from '@softsky/utils'

import { Query } from '@/services/db/query'
import { DEFAULT_COLUMNS, TableWithUser } from '@/services/db/table'
import { TableDTO } from '@/services/db/types'
import TABLES from '@/services/tables'
import { StorageFile, StorageFileStatus } from '@/sky-shared/storage'

export class StorageFileTable extends TableWithUser<
  StorageFile,
  TableDTO<StorageFile>,
  Query<
    ObjectCamelToSnakeCase<StorageFile>,
    ObjectCamelToSnakeCase<StorageFile>
  >
> {
  public $getByHashAndStatus = this.query
    .clone()
    .where<{
      hash: string
      status: StorageFileStatus
    }>('hash = $hash AND status = $status')
    .toDBQuery()

  public constructor() {
    super(TABLES.STORAGE_FILE, {
      ...DEFAULT_COLUMNS,
      userId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: TABLES.USERS,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
      name: {
        type: 'TEXT',
        required: true,
      },
      path: {
        type: 'TEXT',
        required: true,
      },
      size: {
        type: 'INTEGER',
        required: true,
      },
      hash: {
        type: 'TEXT',
        required: true,
      },
      status: {
        type: 'INTEGER',
        default: 0,
      },
    })
    this.createIndex(['path', 'user_id'])
    this.createIndex(['hash'])
  }
}
export const storageFileTable = new StorageFileTable()

export function sha256(data: Bun.BlobOrStringOrBuffer) {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(data)
  return hasher.digest().toString('base64url')
}
