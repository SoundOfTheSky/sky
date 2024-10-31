import { convertFromArray, convertToArray } from '@/services/db/convetrations';
import { DEFAULT_COLUMNS, Table } from '@/services/db/table';
import TABLES from '@/services/tables';
import { TableDefaults } from '@/sky-shared/db';

export type User = TableDefaults & {
  username: string;
  status: number;
  permissions: string[];
  password: string;
  avatar?: string;
};
export class UsersTable extends Table<User> {
  public $getByUsername = this.query
    .clone()
    .where<{ username: string }>('username = $username')
    .toDBQuery();

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
      password: {
        type: 'TEXT',
        required: true,
      },
      avatar: {
        type: 'TEXT',
      },
    });
  }
}
export const usersTable = new UsersTable();
