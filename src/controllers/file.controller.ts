import { MongoDatabaseConnector } from '@/services/database'
import { fileSystem, FS } from '@/services/fs'
import { File, FileController } from '@/sky-shared/controllers/file.controller'
import { DatabaseConnector } from '@/sky-shared/database'

class BEFileController extends FileController {
  public constructor(
    database: DatabaseConnector<File>,
    protected fs: FS,
  ) {
    super(database)
  }

  protected writeFile(
    hash: string,
    stream: ReadableStream<Uint8Array>,
  ): Promise<void> {
    return this.fs.write(hash, stream)
  }

  protected deleteFile(hash: string): Promise<void> {
    return this.fs.delete(hash)
  }

  protected readFile(hash: string): Promise<ReadableStream<Uint8Array>> {
    return this.fs.read(hash)
  }

  protected async calcHash(
    stream: ReadableStream<Uint8Array>,
  ): Promise<string> {
    const hasher = new Bun.CryptoHasher('sha256')
    for await (const data of stream as unknown as AsyncIterable<Uint8Array>) {
      hasher.update(data)
    }
    return hasher.digest().toString('base64url')
  }
}

export default new BEFileController(
  new MongoDatabaseConnector('files'),
  fileSystem,
)
