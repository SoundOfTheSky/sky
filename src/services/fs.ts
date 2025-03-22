import { cp, mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import Path from 'node:path'

import { ValidationError } from '@softsky/utils'
import { file } from 'bun'
import { lookup as TypeLookUp } from 'mime-types'

type YandexFile = {
  type: 'file' | 'dir'
  name: string
  path: string
  file?: string
  size?: number
  _embedded?: {
    items: YandexFile[]
  }
}
export type FileInfo = {
  path: string
  name: string
  isDirectory: boolean
  content?: FileInfo[]
  size?: number
  mime?: string
}

export class FS {
  protected p(path: string) {
    const globalPath = Path.join(this.rootPath, path)
    if (!globalPath.startsWith(this.rootPath))
      throw new ValidationError('Outside the scope of FS')
    return globalPath
  }

  public constructor(protected rootPath: string) {}

  public async mkDir(path: string): Promise<void> {
    await mkdir(this.p(path), {
      recursive: true,
    })
    return
  }

  public async getInfo(path: string, readDirectory = true): Promise<FileInfo> {
    try {
      const p = this.p(path)
      const stats = await stat(p)
      const isDirectory = stats.isDirectory()
      const name = Path.basename(p)
      return {
        isDirectory,
        name,
        path,
        content:
          readDirectory && isDirectory
            ? await readdir(p).then((paths) =>
                Promise.all(
                  paths.map((path) =>
                    this.getInfo(path.slice(this.rootPath.length + 1), false),
                  ),
                ),
              )
            : undefined,
        size: stats.size,
        mime: isDirectory ? undefined : TypeLookUp(name) || undefined,
      }
    } catch (error) {
      throw this.errorHandler(error)
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async read(path: string) {
    return file(this.p(path)).stream()
  }

  public async write(path: string, stream: ReadableStream<Uint8Array>) {
    await file(this.p(path)).write(new Response(stream))
  }

  public async delete(path: string): Promise<void> {
    await rm(this.p(path), {
      force: true,
      recursive: true,
    })
  }

  public async copy(from: string, to: string): Promise<void> {
    await cp(this.p(from), this.p(to), {
      recursive: true,
    })
  }

  public async rename(from: string, to: string): Promise<void> {
    await rename(this.p(from), this.p(to))
  }

  protected errorHandler(error: unknown) {
    if (error instanceof Error && (error as ErrnoException).code === 'ENOENT')
      return new Error('NO_FILE')
    return error
  }
}

export class YandexDisk extends FS {
  public constructor(
    protected token: string,
    rootPath: string,
  ) {
    super(rootPath)
  }

  protected p = (path: string) => this.rootPath + path

  protected parseToFileInfo(yFile: YandexFile): FileInfo {
    if ((yFile as unknown as { error: string }).error === 'DiskNotFoundError')
      throw new Error('NO_FILE')
    const fileInfo: FileInfo = {
      path: yFile.path.replace(`disk:${this.rootPath}`, ''),
      isDirectory: yFile.type === 'dir',
      name: yFile.name,
    }
    if (yFile.size !== undefined && yFile.size > 0) fileInfo.size = yFile.size
    if (yFile._embedded?.items)
      fileInfo.content = yFile._embedded.items.map(
        this.parseToFileInfo.bind(this),
      )
    const mime = TypeLookUp(fileInfo.name)
    if (mime) fileInfo.mime = mime
    return fileInfo
  }

  public async mkDir(path: string): Promise<void> {
    await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=${this.p(path)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: 'OAuth ' + this.token,
        },
      },
    )
  }

  public async getInfo(path: string): Promise<FileInfo> {
    return this.parseToFileInfo(
      (await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources?path=${this.p(path)}&limit=999999&preview_crop=false`,
        {
          method: 'GET',
          headers: {
            Authorization: 'OAuth ' + this.token,
          },
        },
      ).then((response) => response.json())) as YandexFile,
    )
  }

  public async read(path: string) {
    const { href } = (await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/download?path=${this.p(path)}`,
      {
        method: 'GET',
        headers: {
          Authorization: 'OAuth ' + this.token,
        },
      },
    ).then((response) => response.json())) as { href: string }
    const response = await fetch(href)
    return response.body!
  }

  public async write(path: string, stream: ReadableStream<Uint8Array>) {
    const { href, method } = (await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/upload?path=${this.p(path)}&overwrite=true`,
      {
        method: 'GET',
        headers: {
          Authorization: 'OAuth ' + this.token,
        },
      },
    ).then((response) => response.json())) as { href: string; method: string }
    await fetch(href, {
      method,
      body: stream,
    })
  }

  public async delete(path: string): Promise<void> {
    await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=${this.p(path)}&force_async=false&permanently=true`,
      {
        method: 'DELETE',
        headers: {
          Authorization: 'OAuth ' + this.token,
        },
      },
    )
  }

  public async copy(from: string, to: string): Promise<void> {
    await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/copy?force_async=false&overwrite=true&from=${this.p(
        from,
      )}&path=${this.p(to)}`,
      {
        method: 'POST',
        headers: {
          Authorization: 'OAuth ' + this.token,
        },
      },
    )
  }

  public async rename(from: string, to: string): Promise<void> {
    await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/move?force_async=false&overwrite=true&from=${this.p(
        from,
      )}&path=${this.p(to)}`,
      {
        method: 'POST',
        headers: {
          Authorization: 'OAuth ' + this.token,
        },
      },
    )
  }

  public async emptyBin() {
    await fetch(
      'https://cloud-api.yandex.net/v1/disk/trash/resources?force_async=false',
      {
        method: 'DELETE',
        headers: {
          Authorization: 'OAuth ' + this.token,
        },
      },
    )
  }
}

export const fileSystem = new FS('files')
export const yandexDisk = new YandexDisk(process.env.YANDEX_TOKEN!, '/website/')
