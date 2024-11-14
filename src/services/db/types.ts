/* eslint-disable @typescript-eslint/no-explicit-any */

import { Optional } from '@softsky/utils'

import { TableDefaults } from 'sky-shared/database'

export type DBDataType = string | number | Uint8Array | null

export type DBRow = Record<string, DBDataType>

export type TableDTO<T extends TableDefaults> = Optional<
  T,
  keyof TableDefaults
>

export type TableColumn = {
  type: keyof ColumnTypeMap
  rename?: string
  primaryKey?: boolean
  autoincrement?: boolean
  to?: (data: any) => DBDataType | undefined
  from?: (data: DBDataType) => any
  required?: boolean
  default?: string | number
  unique?: boolean
  ref?: {
    table: string
    column: string
    onDelete?: 'SET NULL' | 'SET DEFAULT' | 'CASCADE'
    onUpdate?: 'SET NULL' | 'SET DEFAULT' | 'CASCADE'
  }
}

export type ColumnTypeMap = {
  TEXT: string
  INTEGER: number
  REAL: number
  BLOB: Buffer
  NULL: null
}

export type UpdateTableDTO<T> = {
  [P in keyof T]?: T[P] | null | undefined;
}

export type ColumnToType<C extends TableColumn> = C['required'] extends true
  ? ColumnTypeMap[C['type']]
  : ColumnTypeMap[C['type']] | undefined

export type GenerateRowType<T extends Record<string, TableColumn>> = {
  [K in keyof T]: ColumnToType<T[K]>;
}
