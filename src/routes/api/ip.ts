import { server } from '@/index';
import { HTTPHandler } from '@/services/http';
import { ValidationError } from '@/utils';

export default (function (req, res) {
  const data = server.requestIP(req);
  if (!data) throw new ValidationError('Unknown IP');
  res.body = data.address;
} satisfies HTTPHandler);
