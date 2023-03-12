import type { TableDTO } from '../../db';
import { Album, albumsTable } from '../../services/images';
import { getDataFromRequest, ValidationError } from '../../utils';
import type { ApiHandler } from '..';

export default (async function (req, res, query) {
  if (query.pathname !== '/api/photos/album' || req.method !== 'POST') return;
  const rawData = await getDataFromRequest(req);
  const data = JSON.parse(rawData.toString()) as TableDTO<Album>;
  if (!data.title) throw new ValidationError('Title is required');
  res.end(`${albumsTable.create(data).lastInsertRowid}`);
} as ApiHandler);
