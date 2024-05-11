import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';

import { DBTable, TableDefaults, DEFAULT_COLUMNS, DB, DBRow, convertToDate } from '@/services/db';
import { usersTable } from '@/services/session/user';

export enum PlanEventStatus {
  DEFAULT = 0,
  SUCCESS = 1,
  FAILURE = 2,
  SKIP = 3,
}
export type PlanEvent = TableDefaults & {
  title: string;
  start: number; // unix minutes
  duration: number; // Minutes
  userId: number;
  status: PlanEventStatus;
  repeat?: string; // cron
  description?: string;
  parentId?: number;
};
const T = TypeCompiler.Compile(
  Type.Object({
    title: Type.String({
      minLength: 1,
      maxLength: 256,
    }),
    description: Type.Optional(
      Type.String({
        minLength: 1,
        maxLength: 256,
      }),
    ),
    start: Type.Number({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }), // Minute in day
    duration: Type.Number({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }), // Minutes
    userId: Type.Number({
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    }),
    repeat: Type.Optional(Type.String()), // cors
    status: Type.Enum({
      DEFAULT: 0,
      SUCCESS: 1,
      FAILURE: 2,
      SKIP: 3,
    }),
  }),
);

export class PlanEventsTable extends DBTable<PlanEvent> {
  constructor(table: string) {
    super(table, {
      ...DEFAULT_COLUMNS,
      title: {
        type: 'TEXT',
        required: true,
      },
      start: {
        type: 'INTEGER',
        required: true,
      },
      duration: {
        type: 'INTEGER',
        required: true,
      },
      userId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: usersTable.name,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
      status: {
        type: 'INTEGER',
        required: true,
      },
      repeat: {
        type: 'TEXT',
      },
      description: {
        type: 'TEXT',
      },
      parentId: {
        type: 'INTEGER',
        ref: {
          table: table,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
    });
  }
  queries = {
    getByIdAndUser: DB.prepare<DBRow, [number, number]>(`SELECT * FROM ${this.name} WHERE id = ? AND user_id = ?`),
    getUpdated: DB.prepare<{ id: number; updated: number }, [number, string]>(
      `SELECT id, unixepoch(updated) updated FROM ${this.name} WHERE user_id = ? AND updated > ?`,
    ),
  };

  getByIdAndUser(id: number, userId: number) {
    return this.convertFrom(this.queries.getByIdAndUser.get(id, userId));
  }

  getUpdated(userId: number, updated: number) {
    return this.queries.getUpdated.values(userId, convertToDate(new Date(updated * 1000))!) as [number, number][];
  }
}
export const planEventsTable = new PlanEventsTable('plan_events');

// setTimeout(() => {
//   console.log(1);
//   // planEventsTable.create({
//   //   start: ~~(Date.now() / 60000) - 60,
//   //   duration: 30,
//   //   status: PlanEventStatus.DEFAULT,
//   //   title: 'Work out',
//   //   userId: 1,
//   //   description: 'test\ndesc',
//   //   repeat: 1440,
//   // });
//   // planEventsTable.create({
//   //   start: ~~(Date.now() / 60000) + 1440,
//   //   duration: 30,
//   //   status: PlanEventStatus.DEFAULT,
//   //   title: 'Work out 2',
//   //   userId: 1,
//   //   repeat: 1440,
//   //   parentId: 1,
//   // });
//   // planEventsTable.create({
//   //   start: ~~(Date.now() / 60000) - 1440,
//   //   duration: 30,
//   //   status: PlanEventStatus.DEFAULT,
//   //   title: 'test',
//   //   userId: 1,
//   // });
//   // planEventsTable.create({
//   //   start: ~~(Date.now() / 60000) + 1440,
//   //   duration: 30,
//   //   status: PlanEventStatus.DEFAULT,
//   //   title: 'test2',
//   //   userId: 1,
//   // });
//   console.log(planEventsTable.getActive(1, 0, Number.MAX_SAFE_INTEGER));
// });
