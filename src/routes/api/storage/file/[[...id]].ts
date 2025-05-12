import { noop, ValidationError } from '@softsky/utils'

import { convertToDate } from '@/services/db/convetrations'
import { fileSystem } from '@/services/fs'
import { createRestEndpointHandler, RESTApiUser } from '@/services/http/rest'
import { HTTPError } from '@/services/http/utilities'
import { storageFileTable } from '@/services/storage/storage-file'
import {
  StorageFile,
  StorageFileDTO,
  StorageFileStatus,
  StorageFileT,
} from '@/sky-shared/storage'

export default createRestEndpointHandler(
  new (class extends RESTApiUser<StorageFile, StorageFileDTO> {
    public constructor() {
      super(
        storageFileTable,
        {
          updated: {
            convertTo: (data) =>
              convertToDate(new Date(Number.parseInt(data) * 1000))!,
          },
          path: {},
        },
        {
          updated: ['updated'],
          path: ['path'],
        },
      )
    }

    public create(data: StorageFileDTO): Promise<StorageFile> {
      if (data.status !== StorageFileStatus.FOLDER) {
        if (!data.hash) throw new ValidationError('WRONG_HASH')
        console.log(data)
        if (
          !storageFileTable.checkPathFoldersExist(
            data.userId!,
            data.path ? data.path.split('/') : [],
          )
        )
          throw new ValidationError('NO_PATH')
        data.status = storageFileTable.$getByHashAndStatus.get({
          hash: data.hash,
          status: StorageFileStatus.DEFAULT,
        })
          ? StorageFileStatus.DEFAULT
          : StorageFileStatus.NOT_UPLOADED
      }
      return super.create(data)
    }

    public async update(
      id: number,
      data: StorageFileDTO,
    ): Promise<StorageFile> {
      const existing = storageFileTable.getById(id)
      if (!existing) throw new ValidationError('NOT_FOUND')
      data.status = existing.status
      if (
        !storageFileTable.checkPathFoldersExist(
          data.userId!,
          data.path ? data.path.split('/') : [],
        )
      )
        throw new ValidationError('NO_PATH')
      if (data.hash && data.hash !== existing.hash) {
        ;(data as StorageFile).status = StorageFileStatus.NOT_UPLOADED
        const existing = storageFileTable.$getByHashAndStatus.all({
          hash: data.hash,
          status: StorageFileStatus.DEFAULT,
        })
        if (existing.length === 1)
          await fileSystem.delete(data.hash).catch(noop)
      }
      return super.update(id, data)
    }

    public async delete(parameters: {
      id: number
      userId: number
    }): Promise<void> {
      const item = storageFileTable.getByIdUser(
        parameters.id,
        parameters.userId,
      )
      if (!item) throw new HTTPError('NOT FOUND', 404)
      if (
        item.status === StorageFileStatus.FOLDER &&
        storageFileTable.$getPathLike.get({
          path: `${item.path}/${item.name}%`,
          userId: parameters.userId,
        })
      )
        throw new ValidationError('FOLDER_NOT_EMPTY')
      if (item.hash) {
        const existing = storageFileTable.$getByHashAndStatus.all({
          hash: item.hash,
          status: StorageFileStatus.DEFAULT,
        })
        if (existing.length === 1)
          await fileSystem.delete(item.hash).catch(noop)
      }
      return super.delete(parameters)
    }
  })(),
  StorageFileT,
  'STORAGE',
  'STORAGE',
)
