import { AuthenticatorTransportFuture, CredentialDeviceType } from '@simplewebauthn/types';

import { convertFromArray, convertFromBoolean, convertToArray, convertToBoolean } from '@/services/db/convetrations';
import { DB } from '@/services/db/db';
import { DEFAULT_COLUMNS, Table, TableWithUser } from '@/services/db/table';
import TABLES from '@/services/tables';
import { TableDefaults } from '@/sky-shared/db';

export type User = TableDefaults & {
  username: string;
  status: number;
  permissions: string[];
  avatar?: string;
};
export class UsersTable extends Table<User> {
  public $getByUsername = this.query.clone().where<{ username: string }>('username = $username').toDBQuery();

  public constructor() {
    super(TABLES.USERS, {
      ...DEFAULT_COLUMNS,
      username: {
        type: 'TEXT',
        required: true,
      },
      status: {
        type: 'INTEGER',
        default: 0,
      },
      permissions: {
        type: 'TEXT',
        required: true,
        from: convertFromArray,
        to: convertToArray,
      },
      avatar: {
        type: 'TEXT',
      },
    });
  }
}
export const usersTable = new UsersTable();
export type Authenticator = TableDefaults & {
  credentialID: string;
  credentialPublicKey: Buffer;
  counter: number;
  credentialDeviceType: CredentialDeviceType;
  credentialBackedUp: boolean;
  userId: number;
  transports?: AuthenticatorTransportFuture[];
};
class AuthenticatorsTable extends TableWithUser<Authenticator> {
  public $updateCounter = DB.prepare<undefined, { counter: number; user_id: number }>(
    `UPDATE ${this.name} SET counter = $counter WHERE user_id = $user_id`,
  );

  public $getByUserId = this.query.clone().where<{ id: number }>('user_id = $id').toDBQuery();

  public constructor() {
    super(TABLES.AUTHENTICATORS, {
      ...DEFAULT_COLUMNS,
      credentialID: {
        type: 'TEXT',
        required: true,
        primaryKey: true,
        rename: 'id',
      },
      credentialPublicKey: {
        type: 'BLOB',
        required: true,
      },
      counter: {
        type: 'INTEGER',
        required: true,
      },
      credentialDeviceType: {
        type: 'TEXT',
        required: true,
      },
      credentialBackedUp: {
        type: 'INTEGER',
        required: true,
        to: convertToBoolean,
        from: convertFromBoolean,
      },
      transports: {
        type: 'TEXT',
        to: convertToArray,
        from: convertFromArray,
      },
      userId: {
        type: 'INTEGER',
        required: true,
        ref: {
          column: 'id',
          table: TABLES.USERS,
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
    });
  }
}
export const authenticatorsTable = new AuthenticatorsTable();
