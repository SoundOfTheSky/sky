import { imagesAlbumsTable } from '../../services/images';
import type { ApiHandler } from '..';
import { ValidationError } from '../../utils';
export default (function (req, res, query) {
  if (query.pathname !== '/api/photos/album' || req.method !== 'PUT') return;
  const imageId = Number.parseInt(query.searchParams.get('image_id') ?? '');
  if (Number.isNaN(imageId)) throw new ValidationError('No image id supplied!');
  const albumId = Number.parseInt(query.searchParams.get('album_id') ?? '');
  if (Number.isNaN(albumId)) throw new ValidationError('No album id supplied!');
  imagesAlbumsTable.create({ imageId, albumId });
  res.end();
} as ApiHandler);
