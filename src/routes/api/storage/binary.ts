import { parseInt, ValidationError } from '@softsky/utils'

import { fileSystem } from '@/services/fs'
import { HTTPHandler } from '@/services/http/types'
import { HTTPError } from '@/services/http/utilities'
import { sessionGuard } from '@/services/session/session'
import { sha256, storageFileTable } from '@/services/storage/storage-file'
import { StorageFileStatus } from '@/sky-shared/storage'

export default (async (request, response, route) => {
  const session = await sessionGuard({
    request,
    response,
    permissions: ['STORAGE'],
    throw401: true,
  })
  const userId =
    (route.query.user_id &&
      session.user.permissions.includes('ADMIN') &&
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      parseInt(route.query.user_id)) ||
    session.user.id
  const fileStorageRow = storageFileTable.getByIdUser(
    parseInt(route.query.id),
    userId,
  )
  if (!fileStorageRow || fileStorageRow.status === StorageFileStatus.FOLDER)
    throw new HTTPError('Not found', 404)
  if (request.method === 'GET') {
    try {
      const fileInfo = await fileSystem.getInfo(fileStorageRow.hash!)
      response.body = (await fileSystem.read(
        fileStorageRow.hash!,
      )) as unknown as AsyncIterable<Uint8Array>
      response.headers.set('content-type', fileInfo.mime ?? 'text')
      response.headers.set('content-length', fileInfo.size?.toString() ?? '0')
      response.headers.set(
        'content-disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(fileStorageRow.name)}`,
      )
    } catch (error) {
      throw error instanceof Error && error.message === 'NO_FILE'
        ? new HTTPError('Not found', 404)
        : error
    }
  } else if (request.method === 'POST') {
    if (fileStorageRow.status !== StorageFileStatus.NOT_UPLOADED) return
    try {
      await fileSystem.getInfo(fileStorageRow.hash!)
    } catch (error) {
      if (error instanceof Error && error.message === 'NO_FILE') {
        const data = await request.arrayBuffer()
        const hash = sha256(data)
        if (fileStorageRow.hash !== hash)
          throw new ValidationError('WRONG_FILE_HASH')
        if (fileStorageRow.size !== data.byteLength)
          throw new ValidationError('WRONG_SIZE')
        await fileSystem.write(hash, new Response(data).body!)
        storageFileTable.update(fileStorageRow.id, {
          status: StorageFileStatus.DEFAULT,
        })
      } else {
        console.error(error)
        throw error
      }
    }
  }
}) satisfies HTTPHandler
