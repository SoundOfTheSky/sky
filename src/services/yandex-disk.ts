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
  isDir: boolean
  content?: FileInfo[]
  size?: number
  mime?: string
}

export class YandexDisk {
  public constructor(
    protected token: string,
    protected rootPath: string,
  ) {}

  protected p = (path: string) => this.rootPath + path

  protected parseToFileInfo(yFile: YandexFile): FileInfo {
    const fileInfo: FileInfo = {
      path: yFile.path.replace(`disk:${this.rootPath}`, ''),
      isDir: yFile.type === 'dir',
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
      ).then(response => response.json())) as YandexFile,
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
    ).then(response => response.json())) as { href: string }
    return fetch(href)
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
    ).then(response => response.json())) as { href: string, method: string }
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

  public async copy(from: string, path: string): Promise<void> {
    await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/copy?force_async=false&overwrite=true&from=${this.p(
        from,
      )}&path=${this.p(path)}`,
      {
        method: 'POST',
        headers: {
          Authorization: 'OAuth ' + this.token,
        },
      },
    )
  }

  public async move(from: string, path: string): Promise<void> {
    await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/move?force_async=false&overwrite=true&from=${this.p(
        from,
      )}&path=${this.p(path)}`,
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

export default new YandexDisk(process.env.YANDEX_TOKEN!, '/website/')
