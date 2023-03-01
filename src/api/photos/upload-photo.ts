import { getDataFromRequest } from '../../utils';

import type { ApiHandler } from '..';
import { imagesTable } from '../../services/images';
export type UploadFileDTO = {
  base64: string;
  description: string;
};
export default (async function (req, res, query) {
  if (query.pathname !== '/api/photos' || req.method !== 'POST') return;
  const rawData = await getDataFromRequest(req);
  const data = JSON.parse(rawData.toString()) as UploadFileDTO;
  const buffer = Buffer.from(data.base64, 'base64');
  const uploadedImg = await imagesTable.uploadImage(buffer, data.description);
  res.end(`${uploadedImg.lastInsertRowid}`);
} as ApiHandler);
