import { request } from 'node:https';
import type { ReadStream } from 'node:fs';
import { $fetch } from 'ohmyfetch';

type YandexFile = {
  type: 'file' | 'dir';
  name: string;
  file?: string;
  size?: number;
  _embedded?: {
    items: YandexFile[];
  };
};
export type FileInfo = {
  name: string;
  isDir: boolean;
  content?: FileInfo[];
  size?: number;
};
export type FS = {
  mkDir(path: string): Promise<void>;
  getInfo(path: string): Promise<FileInfo>;
  readFile(path: string): Promise<Buffer>;
  write(path: string, buffer: Buffer): Promise<void>;
  delete(path: string): Promise<void>;
  copy?(oldPath: string, newPath: string): Promise<void>;
  move?(oldPath: string, newPath: string): Promise<void>;
};

export class YandexDisk implements FS {
  constructor(private token: string) {}
  private endpoint = 'https://cloud-api.yandex.net/v1/disk/resources';
  private parseToFileInfo(yFile: YandexFile): FileInfo {
    const fileInfo: FileInfo = {
      isDir: yFile.type === 'dir',
      name: yFile.name,
    };
    if (yFile.size !== undefined && yFile.size > 0) fileInfo.size = yFile.size;
    if (yFile._embedded?.items) fileInfo.content = yFile._embedded.items.map(this.parseToFileInfo.bind(this));
    return fileInfo;
  }
  async mkDir(path: string): Promise<void> {
    await $fetch(this.endpoint, {
      method: 'PUT',
      params: {
        path,
      },
      headers: {
        Authorization: 'OAuth ' + this.token,
      },
    });
  }

  async getInfo(path: string): Promise<FileInfo> {
    return this.parseToFileInfo(
      await $fetch<YandexFile>(this.endpoint, {
        method: 'GET',
        params: {
          path,
          limit: 999_999,
          preview_crop: false,
        },
        headers: {
          Authorization: 'OAuth ' + this.token,
        },
      }),
    );
  }

  async readFile(path: string): Promise<Buffer> {
    const { href } = await $fetch<{ href: string }>('https://cloud-api.yandex.net/v1/disk/resources/download', {
      method: 'GET',
      params: {
        path,
      },
      headers: {
        Authorization: 'OAuth ' + this.token,
      },
    });
    return Buffer.from(await $fetch(href, { responseType: 'arrayBuffer' }));
  }

  async write(path: string, buffer: Buffer | ReadStream): Promise<void> {
    const { href, method } = await $fetch<{ href: string; method: string }>(
      'https://cloud-api.yandex.net/v1/disk/resources/upload',
      {
        method: 'GET',
        params: {
          path,
          overwrite: true,
        },
        headers: {
          Authorization: 'OAuth ' + this.token,
        },
      },
    );
    return new Promise((resolve, reject) => {
      const req = request(href, {
        method,
        headers: {
          Authorization: 'OAuth ' + this.token,
          'Content-Type': 'application/binary',
        },
      });
      if (Buffer.isBuffer(buffer)) {
        let i = 0;
        const chunkSize = 65_536;
        req.write(buffer.subarray(i, i + chunkSize));
        i += chunkSize;
        req.on('drain', () => {
          req.write(buffer.subarray(i, i + chunkSize));
          i += chunkSize;
          if (i >= buffer.length) req.end();
        });
      } else {
        buffer.pipe(req);
      }
      req.on('error', reject);
      req.on('finish', resolve);
    });
  }

  async delete(path: string): Promise<void> {
    await $fetch(this.endpoint, {
      method: 'DELETE',
      params: {
        force_async: false,
        path,
        permanently: true,
      },
      headers: {
        Authorization: 'OAuth ' + this.token,
      },
    });
  }

  async copy(from: string, path: string): Promise<void> {
    await $fetch('https://cloud-api.yandex.net/v1/disk/resources/copy', {
      method: 'POST',
      params: {
        force_async: false,
        overwrite: true,
        from,
        path,
      },
      headers: {
        Authorization: 'OAuth ' + this.token,
      },
    });
  }

  async move(from: string, path: string): Promise<void> {
    await $fetch('https://cloud-api.yandex.net/v1/disk/resources/move', {
      method: 'POST',
      params: {
        force_async: false,
        overwrite: true,
        from,
        path,
      },
      headers: {
        Authorization: 'OAuth ' + this.token,
      },
    });
  }

  async emptyBin() {
    await $fetch('https://cloud-api.yandex.net/v1/disk/trash/resources', {
      method: 'DELETE',
      params: {
        force_async: false,
      },
      headers: {
        Authorization: 'OAuth ' + this.token,
      },
    });
  }
}
const fs = new YandexDisk(process.env['YANDEX_TOKEN']!);
export default fs;
