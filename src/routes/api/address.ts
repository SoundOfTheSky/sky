import server from '@/index';
import { HTTPHandler } from '@/services/http/types';
import { ValidationError } from '@/utils';

export default (async function (req, res) {
  const data = server.requestIP(req);
  if (!data) throw new ValidationError('Unknown IP');
  res.headers.set('Content-Type', 'application/json');
  data.address = '193.93.237.23';
  res.body = await fetch(`http://ip-api.com/json/${data.address}?fields=131289`).then((x) => x.text());
} satisfies HTTPHandler);
