import { imagesAlbumsTable } from '../../services/images';
import type { ApiHandler } from '..';
export default (function (req, res, query) {
  if (query.pathname !== '/api/photos/album' || req.method !== 'PUT') return;
  const imageId = Number.parseInt(query.searchParams.get('image_id') ?? '');
  if (Number.isNaN(imageId)) {
    res.writeHead(400).end('No image id supplied!');
    return;
  }
  const albumId = Number.parseInt(query.searchParams.get('album_id') ?? '');
  if (Number.isNaN(albumId)) {
    res.writeHead(400).end('No album id supplied!');
    return;
  }
  imagesAlbumsTable.create({ imageId, albumId });
  res.end();
} as ApiHandler);
