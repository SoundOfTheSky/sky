import { createHash } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';

import { DB, DBTable, TableDefaults, TableDTO } from '../db';
import { formatBytes, log, ValidationError, wait } from '../utils';
import fs from './fs';
import { OPTIMIZABLE_IMAGES, optimizeImage } from './convert-image';

const BASE_DIR = '/website/photos/';

export type Image = TableDefaults & {
  path: string;
  description?: string;
  md5: string;
  originalMd5: string;
};
export class ImagesTable extends DBTable<Image> {
  constructor(table: string) {
    super(table, {
      path: {
        type: 'TEXT',
        required: true,
      },
      description: {
        type: 'TEXT',
      },
      md5: {
        type: 'TEXT',
        required: true,
      },
      original_md5: {
        type: 'TEXT',
        required: true,
      },
    });
  }
  async createImage(data: TableDTO<Image>, buffer: Buffer) {
    await fs.write(data.path, buffer);
    return super.create(data);
  }
  async deleteImage(id: number) {
    const image = this.get(id);
    if (!image) throw new ValidationError('Image not found');
    await fs.delete(image.path);
    return super.delete(id);
  }
  async uploadImage(buffer: Buffer, description: string) {
    const md5 = createHash('md5').update(buffer).digest('hex');
    if (imagesTable.checkExistsMD5(md5)) throw new ValidationError('Image with same MD5 already exists');
    const type = await fileTypeFromBuffer(buffer);
    if (!type) throw new ValidationError('Unknown format');
    const path = BASE_DIR + md5 + '.' + type.ext;
    return imagesTable.createImage({ description, originalMd5: md5, md5, path }, buffer);
  }
  checkExistsMD5(md5: string) {
    return (
      DB.prepare(`SELECT COUNT(1) FROM ${this.name} WHERE md5 = ? OR original_md5 = ?`).get(md5, md5)!['COUNT(1)'] !== 0
    );
  }

  getAllOptimizableImages(): Image[] {
    return DB.prepare(
      `SELECT * FROM ${this.name} WHERE ${OPTIMIZABLE_IMAGES.map((ext) => `path LIKE '%${ext}'`).join(' OR ')}`,
    )
      .all()
      .map((el) => this.convertFrom(el)!);
  }
}
export const imagesTable = new ImagesTable('images');

export type Album = TableDefaults & {
  title: string;
  description?: string;
};
export class AlbumsTable extends DBTable<Album> {
  constructor(table: string) {
    super(table, {
      title: {
        type: 'TEXT',
        required: true,
      },
      description: {
        type: 'TEXT',
      },
    });
  }
}
export const albumsTable = new AlbumsTable('albums');

export type ImagesAlbums = TableDefaults & {
  imageId: number;
  albumId: number;
};
export class ImagesAlbumsTable extends DBTable<ImagesAlbums> {
  private dependencyTables;
  constructor(
    table: string,
    dependencyTables: {
      albumsTable: AlbumsTable;
      imagesTable: ImagesTable;
    },
  ) {
    super(table, {
      imageId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: dependencyTables.imagesTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
      albumId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: dependencyTables.albumsTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
    });
    this.dependencyTables = dependencyTables;
  }
  deleteByImageAndAlbum(image_id: number, album_id: number) {
    return DB.prepare(`DELETE FROM ${this.name} WHERE image_id = ? AND album_id = ?`).run(image_id, album_id);
  }
  getImageAlbums(id: number): Album[] {
    return DB.prepare(
      `SELECT * FROM ${this.dependencyTables.albumsTable.name} a
      JOIN ${this.dependencyTables.imagesTable.name} x
      ON a.id = x.album_id
      WHERE x.image_id = ?`,
    )
      .all(id)
      .map((el) => this.dependencyTables.albumsTable.convertFrom(el)!);
  }
  getAlbumImages(id: number): Image[] {
    return DB.prepare(
      `SELECT * FROM ${this.dependencyTables.imagesTable.name} a
      JOIN ${this.dependencyTables.albumsTable.name} x
      ON a.id = x.image_id
      WHERE x.album_id = ?`,
    )
      .all(id)
      .map((el) => this.dependencyTables.imagesTable.convertFrom(el)!);
  }
}
export const imagesAlbumsTable = new ImagesAlbumsTable('images_albums', {
  albumsTable,
  imagesTable,
});

let maintenanceInProgress = false;
export async function startMaintenance() {
  if (maintenanceInProgress) return;
  maintenanceInProgress = true;
  log('Starting maintenance');
  const imagesToOptimize = imagesTable.getAllOptimizableImages();
  if (imagesToOptimize.length > 0) log(`Images to optimize: ${imagesToOptimize.length}`);
  for (const image of imagesToOptimize) {
    log('Optimizing: ', image.path);
    const now = Date.now();
    try {
      const buffer = await fs.readFile(image.path);
      const optimizedBuffer = await optimizeImage(buffer, image.path.slice(image.path.lastIndexOf('.') + 1));
      const md5 = createHash('md5').update(optimizedBuffer).digest('hex');
      if (imagesTable.checkExistsMD5(md5)) {
        await imagesTable.deleteImage(image.id);
        continue;
      }
      const newPath = BASE_DIR + md5 + '.webp';
      await fs.copy(image.path, newPath);
      await fs.delete(image.path);
      imagesTable.update(image.id, {
        md5,
        path: newPath,
      });
      log(
        `Time: ${Date.now() - now}ms | Storage cleared: ${formatBytes(
          buffer.BYTES_PER_ELEMENT - optimizedBuffer.BYTES_PER_ELEMENT,
        )}`,
      );
    } catch (error) {
      log('Error while optimizing', error);
    }
    await wait(10_000);
  }
  // deleteImagesWithoutLink
  const { content } = await fs.getInfo(BASE_DIR);
  if (!content) throw new ValidationError('Error while getting FS content');
  const fsFiles = content.map((x) => x.name);
  const dbFiles = imagesTable.getAll().map((x) => x.path.slice(BASE_DIR.length));
  for (const file of new Set([...fsFiles, ...dbFiles])) {
    if (!dbFiles.includes(file)) {
      log('Clear unlinked from FS:', file);
      await fs.delete(BASE_DIR + file);
    } else if (!fsFiles.includes(file)) {
      log('Clear unlinked from DB:', file);
      DB.prepare('DELETE FROM images WHERE path = ?').run(BASE_DIR + file);
    }
  }
  maintenanceInProgress = false;
}
setTimeout(() => void startMaintenance(), 86_400_000);
