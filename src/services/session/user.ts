import { AuthenticatorTransportFuture, CredentialDeviceType } from '@simplewebauthn/types';

import {
  DB,
  DBTable,
  convertFromArray,
  convertFromBoolean,
  convertToArray,
  convertToBoolean,
  DEFAULT_COLUMNS,
} from '@/services/db';
import TABLES from '@/services/tables';
import { DBRow, TableDefaults } from '@/sky-shared/db';

export type User = TableDefaults & {
  username: string;
  status: number;
  permissions: string[];
  avatar?: string;
};
export class UsersTable extends DBTable<User> {
  private $checkIfUsernameExists = DB.prepare<{ a: number }, string>(
    `SELECT COUNT(*) a FROM ${this.name} WHERE username = ?`,
  );
  private $getByUsername = DB.prepare<User, [string]>(`SELECT * FROM ${this.name} WHERE username = ?`);

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

  public checkIfUsernameExists(username: string) {
    return this.$checkIfUsernameExists.get(username)!.a !== 0;
  }

  public getByUsername(username: string) {
    return this.convertFrom(this.$getByUsername.get(username));
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
class AuthenticatorsTable extends DBTable<Authenticator> {
  protected $updateCounter = DB.prepare<undefined, [number, number]>(
    `UPDATE ${this.name} SET counter = ? WHERE user_id = ?`,
  );
  protected $getAllByUser = DB.prepare<DBRow, [number]>(`SELECT * FROM ${this.name} WHERE user_id = ?`);
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

  public updateCounter(userId: number, counter: number) {
    this.$updateCounter.run(counter, userId);
  }

  public getAllByUser(userId: number): Authenticator[] {
    return this.$getAllByUser.all(userId).map((x) => this.convertFrom(x)) as Authenticator[];
  }
}
export const authenticatorsTable = new AuthenticatorsTable();
