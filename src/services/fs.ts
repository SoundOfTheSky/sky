import { createReadStream, ReadStream, createWriteStream } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { lookup as TypeLookUp } from 'mime-types';
import got, { Method, Progress } from 'got';
import { chunkifyBuffer } from '../utils';

type YandexFile = {
  type: 'file' | 'dir';
  name: string;
  path: string;
  file?: string;
  size?: number;
  _embedded?: {
    items: YandexFile[];
  };
};
export type FileInfo = {
  path: string;
  name: string;
  isDir: boolean;
  content?: FileInfo[];
  size?: number;
  mime?: string;
};
export type FS = {
  mkDir(path: string): Promise<void>;
  getInfo(path: string): Promise<FileInfo>;
  readFile(path: string): Promise<Buffer>;
  readStream(path: string): Readable;
  write(path: string, buffer: Buffer | Readable): Promise<void>;
  delete(path: string): Promise<void>;
  copy?(oldPath: string, newPath: string): Promise<void>;
  move?(oldPath: string, newPath: string): Promise<void>;
};

export class YandexDisk implements FS {
  constructor(private token: string, private rootPath: string) {}

  private endpoint = 'https://cloud-api.yandex.net/v1/disk/resources';

  private p = (path: string) => this.rootPath + path;

  private parseToFileInfo(yFile: YandexFile): FileInfo {
    const fileInfo: FileInfo = {
      path: yFile.path.replace(`disk:${this.rootPath}`, ''),
      isDir: yFile.type === 'dir',
      name: yFile.name,
    };
    if (yFile.size !== undefined && yFile.size > 0) fileInfo.size = yFile.size;
    if (yFile._embedded?.items) fileInfo.content = yFile._embedded.items.map(this.parseToFileInfo.bind(this));
    return fileInfo;
  }

  async mkDir(path: string): Promise<void> {
    await got(this.endpoint, {
      method: 'PUT',
      searchParams: {
        path: this.p(path),
      },
      headers: {
        Authorization: 'OAuth ' + this.token,
      },
    });
  }

  async getInfo(path: string): Promise<FileInfo> {
    return this.parseToFileInfo(
      await got(this.endpoint, {
        method: 'GET',
        searchParams: {
          path: this.p(path),
          limit: 999_999,
          preview_crop: false,
        },
        headers: {
          Authorization: 'OAuth ' + this.token,
        },
      }).json(),
    );
  }

  async readFile(path: string): Promise<Buffer> {
    const { href } = await got('https://cloud-api.yandex.net/v1/disk/resources/download', {
      method: 'GET',
      searchParams: {
        path: this.p(path),
      },
      headers: {
        Authorization: 'OAuth ' + this.token,
      },
    }).json<{ href: string }>();
    return got(href).buffer();
  }

  async write(path: string, buffer: Buffer | ReadStream, progress?: (data: Progress) => unknown): Promise<void> {
    const { href, method } = await got('https://cloud-api.yandex.net/v1/disk/resources/upload', {
      method: 'GET',
      searchParams: {
        path: this.p(path),
        overwrite: true,
      },
      headers: {
        Authorization: 'OAuth ' + this.token,
      },
    }).json<{ href: string; method: Method }>();
    return new Promise((resolve, reject) => {
      const stream = got.stream(href, {
        method,
        headers: {
          Authorization: 'OAuth ' + this.token,
          'Content-Type': 'application/binary',
        },
        body: Buffer.isBuffer(buffer) ? chunkifyBuffer(buffer) : buffer,
      });

      if (progress) stream.on('uploadProgress', progress);
      stream.on('close', resolve);
      stream.on('error', reject);
    });
  }

  async delete(path: string): Promise<void> {
    await got(this.endpoint, {
      method: 'DELETE',
      searchParams: {
        force_async: false,
        path: this.p(path),
        permanently: true,
      },
      headers: {
        Authorization: 'OAuth ' + this.token,
      },
    });
  }

  async copy(from: string, path: string): Promise<void> {
    await got('https://cloud-api.yandex.net/v1/disk/resources/copy', {
      method: 'POST',
      searchParams: {
        force_async: false,
        overwrite: true,
        from: this.p(from),
        path: this.p(path),
      },
      headers: {
        Authorization: 'OAuth ' + this.token,
      },
    });
  }

  async move(from: string, path: string): Promise<void> {
    await got('https://cloud-api.yandex.net/v1/disk/resources/move', {
      method: 'POST',
      searchParams: {
        force_async: false,
        overwrite: true,
        from: this.p(from),
        path: this.p(path),
      },
      headers: {
        Authorization: 'OAuth ' + this.token,
      },
    });
  }

  readStream(path: string, progress?: (data: Progress) => unknown): Readable {
    const stream = new PassThrough();
    got('https://cloud-api.yandex.net/v1/disk/resources/download', {
      searchParams: {
        path: this.p(path),
      },
      headers: {
        Authorization: 'OAuth ' + this.token,
      },
    })
      .json<{ href: string }>()
      .then(({ href }) => {
        const downloadStream = got.stream(href);
        if (progress) downloadStream.on('downloadProgress', progress);
        downloadStream.pipe(stream);
      })
      .catch(() => stream.destroy());
    return stream;
  }

  async emptyBin() {
    await got('https://cloud-api.yandex.net/v1/disk/trash/resources', {
      method: 'DELETE',
      searchParams: {
        force_async: false,
      },
      headers: {
        Authorization: 'OAuth ' + this.token,
      },
    });
  }
}
export class InnerFS implements FS {
  constructor(private rootPath: string) {}

  private p = (path: string) => join(this.rootPath, path);

  async mkDir(path: string): Promise<void> {
    await mkdir(this.p(path));
  }

  async getInfo(path: string, skipContent?: boolean): Promise<FileInfo> {
    const p = this.p(path);
    const s = await stat(p);
    const fileInfo: FileInfo = {
      path: p,
      isDir: s.isDirectory(),
      name: basename(path),
    };
    if (fileInfo.isDir && !skipContent) {
      const files = await readdir(p);
      fileInfo.content = await Promise.all(files.map((name) => this.getInfo(join(p, name), true)));
    } else {
      fileInfo.size = s.size;
      const mime = TypeLookUp(fileInfo.name);
      if (mime) fileInfo.mime = mime;
    }
    return fileInfo;
  }

  readFile(path: string): Promise<Buffer> {
    return readFile(this.p(path));
  }

  async write(path: string, buffer: Buffer | Readable): Promise<void> {
    if (Buffer.isBuffer(buffer)) await writeFile(this.p(path), buffer);
    else
      return new Promise((resolve) => {
        const stream = createWriteStream(this.p(path));
        buffer.pipe(stream);
        stream.on('close', resolve);
      });
  }

  async delete(path: string): Promise<void> {
    await rm(this.p(path), {
      recursive: true,
    });
  }

  async copy(from: string, path: string): Promise<void> {
    const f = this.p(from);
    const p = this.p(path);
    const s = await stat(f);
    if (s.isDirectory()) {
      const files = await readdir(f);
      for (const file of files) await this.copy(join(from, file), join(path, file));
    } else await copyFile(f, p);
  }

  async move(from: string, path: string): Promise<void> {
    await rename(this.p(from), this.p(path));
  }

  readStream(path: string): ReadStream {
    return createReadStream(this.p(path));
  }
}
export const yandexDiskFS = new YandexDisk(process.env['YANDEX_TOKEN']!, '/website/');
export const innerFS = new InnerFS('');
export default yandexDiskFS;
