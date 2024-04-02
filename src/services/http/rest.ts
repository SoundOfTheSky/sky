// import { DBTable } from '@/services/db';
// import { HTTPHandler } from '@/services/http/types';
// import { HTTPError } from '@/services/http/utils';
// import { PERMISSIONS } from '@/services/session/user';

// type Guard = boolean | PERMISSIONS[];
// type Action = {
//   enabled: boolean;
//   guard: Guard;
// };
// export default function createRestEndpointHandler<T, DTO>(
//   table: DBTable<T, DTO>,
//   options: Action & {
//     GET?: Action;
//     DELETE?: Action;
//     POST?: Action;
//     PATCH?: Action;
//     PUT?: Action;
//   },
// ): HTTPHandler {
//   return async (req, res, router) => {
//     if (!options.enabled && !options[req.method as 'GET']?.enabled) throw new HTTPError('Method now allowed', 405);
//     let body;
//     if (req.method.startsWith('P')) body = (await req.json()) as unknown;

//     switch (req.method) {
//       case 'GET':
//       case 'DELETE':
//       case 'POST':
//       case 'PATCH':
//       case 'PUT':
//         break;
//     }
//   };
// }
