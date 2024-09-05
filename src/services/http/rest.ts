import { TSchema } from '@sinclair/typebox';
import { TypeCheck } from '@sinclair/typebox/compiler';

import { DBTable, DBTableWithUser } from '@/services/db';
import { HTTPHandler } from '@/services/http/types';
import { HTTPError, sendJSON } from '@/services/http/utils';
import { sessionGuard } from '@/services/session';
import { TableDTO } from '@/sky-shared/db';
import { parseInt, ValidationError } from '@/sky-utils';

export class RESTApi<T, DTO = TableDTO<T>, O = T, I = DTO, TABLE extends DBTable<T, DTO> = DBTable<T, DTO>> {
  public constructor(public table: TABLE) {}

  public getUpdated(time: Date, _userId: number): [number, number][] {
    return this.table.getUpdated(time);
  }

  public get(id: number, _userId: number): O | undefined {
    return this.table.getById(id) as O | undefined;
  }

  public create(data: I, _userId: number): O {
    const changes = this.table.create(data as unknown as DTO);
    return this.table.getById(changes.lastInsertRowid as number) as O;
  }

  public update(id: number, data: I, _userId: number): O | undefined {
    const changes = this.table.update(id, data as unknown as DTO);
    return this.table.getById(changes.lastInsertRowid as number) as O | undefined;
  }

  public delete(id: number, _userId: number): void {
    this.table.deleteById(id);
  }
}

export class RESTApiUser<
  T,
  DTO = TableDTO<T>,
  O = T,
  I = DTO,
  TABLE extends DBTableWithUser<T, DTO> = DBTableWithUser<T, DTO>,
> extends RESTApi<T, DTO, O, I, TABLE> {
  public constructor(table: TABLE) {
    super(table);
  }

  public getUpdated(time: Date, userId: number): [number, number][] {
    return this.table.getUpdatedByUser(time, userId);
  }

  public get(id: number, userId: number): O | undefined {
    return this.table.getByIdUser(id, userId) as O | undefined;
  }

  public create(data: I, userId: number): O {
    (data as { user_id: number })['user_id'] = userId;
    const changes = this.table.create(data as unknown as DTO);
    return this.table.getById(changes.lastInsertRowid as number) as O;
  }

  public update(id: number, data: I, userId: number): O | undefined {
    (data as { user_id: number })['user_id'] = userId;
    const changes = this.table.updateByUser(id, data as unknown as DTO, userId);
    return this.table.getById(changes.lastInsertRowid as number) as O | undefined;
  }

  public delete(id: number, userId: number): void {
    this.table.deleteByIdUser(id, userId);
  }
}

export function createRestEndpointHandler<T, DTO>(
  api: RESTApi<T, DTO>,
  T: TypeCheck<TSchema>,
  viewPermission: string,
  editPermission: string,
): HTTPHandler {
  return async (req, res, route) => {
    const session = await sessionGuard({
      req,
      res,
      permissions: [req.method === 'GET' ? viewPermission : editPermission],
      throw401: true,
    });
    const param = route.params['id'];
    switch (req.method) {
      case 'GET':
        if (param.startsWith('updated/')) {
          const time = Number.parseInt(param.slice(8));
          if (Number.isNaN(time)) throw new ValidationError('Invalid time');
          res.body = api
            .getUpdated(new Date(time * 1000), session.user.id)
            .map(([id, time]) => id + ',' + time)
            .join('\n');
        } else if (param) {
          const item = api.get(parseInt(param), session.user.id);
          if (!item) throw new HTTPError('Not found', 404);
          sendJSON(res, item);
        }
        break;
      case 'DELETE':
        api.delete(parseInt(param), session.user.id);
        break;
      case 'POST':
        const body = (await req.json()) as DTO;
        if (!T.Check(body)) throw new HTTPError('Validation error', 400, JSON.stringify([...T.Errors(body)]));
        if (param) sendJSON(res, api.update(parseInt(param), body, session.user.id));
        else sendJSON(res, api.create(body, session.user.id));
        break;
    }
  };
}
