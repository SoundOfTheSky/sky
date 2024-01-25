import { AuthenticatorTransportFuture, CredentialDeviceType } from '@simplewebauthn/types';
import {
  DB,
  DBTable,
  TableDefaults,
  convertFromArray,
  convertFromBoolean,
  convertToArray,
  convertToBoolean,
  defaultColumns,
} from '@/services/db';

export enum PERMISSIONS {
  HOUSE = 'house',
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
      ...defaultColumns,
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
  credentialID: Buffer;
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
      ...defaultColumns,
      credentialID: {
        type: 'TEXT',
        required: true,
        primaryKey: true,
        rename: 'id',
        to: (from: Buffer | undefined | null) => (from ? from.toString('base64url') : from),
        from: (from) => (typeof from === 'string' ? Buffer.from(from, 'base64url') : from),
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
  getAllByUser(userId: number): Authenticator[] {
    return DB.prepare(`SELECT * FROM ${this.name} WHERE user_id = ?`)
      .all(userId)
      .map(this.convertFrom.bind(this)) as Authenticator[];
  }
}
export const authenticatorsTable = new AuthenticatorsTable('authenticators');
