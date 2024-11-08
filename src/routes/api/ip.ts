import { HTTPHandler } from '@/services/http/types';
import { ValidationError } from 'sky-utils';

export default (function (req, res) {
  const data = server.requestIP(req);
  if (!data) throw new ValidationError('Unknown IP');
  res.body = data.address;
} satisfies HTTPHandler);
