import { HTTPHandler } from '@/services/http/types';
import { wordsTable } from '@/services/words';
import { ValidationError } from '@/utils';

export default (function (req, res, route) {
  const time = Number.parseInt(route.query['time']);
  if (Number.isNaN(time)) throw new ValidationError('Time must be integer');
  res.body = wordsTable
    .getUpdated(time)
    .map(([id, time]) => id + ',' + time)
    .join('\n');
} satisfies HTTPHandler);
