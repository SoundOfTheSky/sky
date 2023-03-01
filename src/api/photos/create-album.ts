import type { TableDTO } from '../../db';
import { Album, albumsTable } from '../../services/images';
import { getDataFromRequest } from '../../utils';
import type { ApiHandler } from '..';

export default (async function (req, res, query) {
  if (query.pathname !== '/api/photos/album' || req.method !== 'POST') return;
  const rawData = await getDataFromRequest(req);
  const data = JSON.parse(rawData.toString()) as TableDTO<Album>;
  if (!data.title) {
    res.writeHead(400).end('No name supplied!');
    return;
  }
  res.end(`${albumsTable.create(data).lastInsertRowid}`);
} as ApiHandler);
