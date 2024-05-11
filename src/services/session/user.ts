import { AuthenticatorTransportFuture, CredentialDeviceType } from '@simplewebauthn/types';

import {
  DB,
  DBTable,
  TableDefaults,
  convertFromArray,
  convertFromBoolean,
  convertToArray,
  convertToBoolean,
  DEFAULT_COLUMNS,
  DBRow,
} from '@/services/db';

export enum PERMISSIONS {
  HOUSE = 'house',
  PLAN = 'plan',
  DISK = 'disk',
  STUDY = 'study',
  ADMIN = 'admin',
}
export type User = TableDefaults & {
  username: string;
  status: number;
  permissions: PERMISSIONS[];
  avatar?: string;
};
export class UsersTable extends DBTable<User> {
  constructor(table: string) {
    super(table, {
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
  queries = {
    checkIfUsernameExists: DB.prepare<{ a: number }, string>(`SELECT COUNT(*) a FROM ${this.name} WHERE username = ?`),
    getByUsername: DB.prepare(`SELECT * FROM ${this.name} WHERE username = ?`),
  };
  checkIfUsernameExists(username: string) {
    return this.queries.checkIfUsernameExists.get(username)!.a !== 0;
  }
  getByUsername(username: string) {
    return this.convertFrom(this.queries.getByUsername.get(username));
  }
}
export const usersTable = new UsersTable('users');
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
  constructor(table: string) {
    super(table, {
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
          table: 'users',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
    });
  }
  private queries = {
    updateCounter: DB.prepare<undefined, [number, number]>(`UPDATE ${this.name} SET counter = ? WHERE user_id = ?`),
    getAllByUser: DB.prepare<DBRow, [number]>(`SELECT * FROM ${this.name} WHERE user_id = ?`),
  };
  updateCounter(userId: number, counter: number) {
    this.queries.updateCounter.run(counter, userId);
  }
  getAllByUser(userId: number): Authenticator[] {
    return this.queries.getAllByUser.all(userId).map((x) => this.convertFrom(x)) as Authenticator[];
  }
}
export const authenticatorsTable = new AuthenticatorsTable('authenticators');
