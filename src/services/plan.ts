import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';

import { DBTable, TableDefaults, DEFAULT_COLUMNS } from '@/services/db';
import { usersTable } from '@/services/session/user';

export enum PlanEventStatus {
  DEFAULT = 0,
  SUCCESS = 1,
  FAILURE = 2,
  SKIP = 3,
}
export type PlanEvent = TableDefaults & {
  title: string;
  description?: string;
  start: number; // Minute in day
  duration: number; // Minutes
  userId: number;
  repeat?: number; // Minutes
  status: PlanEventStatus;
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
    repeat: Type.Optional(
      Type.Number({
        minimum: 0,
        maximum: Number.MAX_SAFE_INTEGER,
      }),
    ), // Minutes
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
      description: {
        type: 'TEXT',
      },
      start: {
        type: 'INTEGER',
        required: true,
      },
      duration: {
        type: 'INTEGER',
        required: true,
      },
      repeat: {
        type: 'INTEGER',
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
    });
  }
}
export const planEventsTable = new PlanEventsTable('plan_events');
