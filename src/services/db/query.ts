/* eslint-disable @typescript-eslint/no-empty-object-type */
import { Statement } from 'bun:sqlite'

import { database } from '@/services/db/database'
import { DBRow } from '@/services/db/types'

type Join = {
  tableName: string
  condition: string
  left?: boolean
}

type Updates<FIELDS extends DBRow> = {
  [P in keyof FIELDS]?: string
}

export enum QUERY_MODE {
  SELECT,
  INSERT,
  DELETE,
  UPDATE,
}

/**
 * SQL query builder
 * Use chain functions to create query.
 * Call toSQL or toDBQuery at any time.
 * Queries are cached.
 *
 * Types:
 * - FIELDS - Fields of table you're selecting from (or joining);
 * - RETURN - Final return type of query;
 * - PARAMETERS - SQL parameters to use in final query.
 */
export class Query<
  FIELDS extends DBRow = {},
  RETURN extends DBRow = FIELDS,
  PARAMETERS extends DBRow | undefined = undefined,
> {
  public mode = QUERY_MODE.SELECT

  protected _conditions?: string[]
  protected _joins?: Join[]
  protected _group?: string
  protected _updateValues?: Updates<FIELDS>
  protected _sort?: {
    field: string
    desc: boolean
  }[]

  protected _limit?: {
    offset?: number
    limit: number
  }

  protected _query?: Statement<
    RETURN,
    PARAMETERS extends undefined ? [] : [PARAMETERS]
  >

  public constructor(
    private from: string | Query<{}, FIELDS, PARAMETERS>,
    private fields?: string[],
  ) {}

  /** Multiple calls don't override each other */
  public where<PARAMS extends DBRow | undefined>(condition: string) {
    if (!condition) throw new Error('Empty condition')
    const self = this as unknown as Query<
      FIELDS,
      RETURN,
      PARAMS extends undefined
        ? PARAMETERS
        : PARAMETERS extends undefined
          ? PARAMS
          : PARAMS & PARAMETERS
    >
    if (!self._conditions) self._conditions = []
    self._conditions.push(condition)
    delete self._query
    return self
  }

  /** Multiple calls don't override each other */
  public join<JOIN_FIELDS extends DBRow>(
    tableName: string,
    condition: string,
    left?: boolean,
  ) {
    if (!this._joins) this._joins = []
    this._joins.push({
      tableName,
      condition,
      left,
    })
    delete this._query
    return this as Query<FIELDS & JOIN_FIELDS, RETURN, PARAMETERS>
  }

  public group(field: string) {
    this._group = field
    delete this._query
    return this
  }

  /** Multiple calls don't override each other */
  public sort(field: string, desc?: boolean) {
    if (!this._sort) this._sort = []
    this._sort.push({
      field,
      desc: desc ?? false,
    })
    delete this._query
    return this
  }

  public limit(limit: number, offset?: number) {
    this._limit = {
      limit,
      offset,
    }
    delete this._query
    return this
  }

  public update(values: Updates<FIELDS>) {
    this._updateValues = values
    delete this._query
    this.mode = QUERY_MODE.UPDATE
    return this
  }

  public delete() {
    this.mode = QUERY_MODE.DELETE
    delete this._query
    return this
  }

  public insert(values: Updates<FIELDS>) {
    this._updateValues = values
    this.mode = QUERY_MODE.INSERT
    delete this._query
    return this
  }

  public toString() {
    switch (this.mode) {
      case QUERY_MODE.SELECT: {
        return `SELECT ${
          this.fields?.join(', ') ?? '*'
        } FROM ${this.fromToString()}${this.joinToString()}${this.whereToString()}${this.groupByToString()}${this.sortByToString()}${this.limitToString()};`
      }
      case QUERY_MODE.DELETE: {
        if (this.from instanceof Query)
          throw new Error('Can not delete subquery')
        return `DELETE FROM ${this.from}${this.whereToString()};`
      }
      case QUERY_MODE.UPDATE: {
        if (this.from instanceof Query)
          throw new Error('Can not update subquery')
        return `UPDATE ${this.from} SET ${Object.entries(this._updateValues!)
          .map(([key, value]) => `${key}=${value}`)
          .join(',')}${this.whereToString()};`
      }
      case QUERY_MODE.INSERT: {
        if (this.from instanceof Query)
          throw new Error('Can not insert into subquery')
        return `INSERT INTO ${this.from} (${Object.keys(this._updateValues!).join(',')}) SET ${Object.values(
          this._updateValues!,
        ).join(',')};`
      }
    }
  }

  public toDBQuery() {
    if (this._query) return this._query
    try {
      this._query = database.prepare(this.toString())
      return this._query
    } catch (error) {
      if (error instanceof Error) error.message += '\nQuery:' + this.toString()
      throw error
    }
  }

  public clone() {
    const query = new Query<FIELDS, RETURN, PARAMETERS>(this.from, this.fields)
    if (this._joins)
      for (const { tableName, condition, left } of this._joins)
        query.join<FIELDS>(tableName, condition, left)
    if (this._conditions)
      for (const condition of this._conditions) query.where(condition)
    if (this._group) query.group(this._group)
    if (this._sort)
      for (const { field, desc } of this._sort) query.sort(field, desc)
    if (this._limit) query.limit(this._limit.limit, this._limit.offset)
    switch (this.mode) {
      case QUERY_MODE.DELETE: {
        query.delete()
        break
      }
      case QUERY_MODE.INSERT: {
        query.insert(this._updateValues!)
        break
      }
      case QUERY_MODE.UPDATE: {
        query.update(this._updateValues!)
        break
      }
    }
    return query
  }

  protected whereToString() {
    if (!this._conditions || this._conditions.length === 0) return ''
    return ` WHERE ${this._conditions.join(' AND ')}`
  }

  protected joinToString() {
    if (!this._joins || this._joins.length === 0) return ''
    return (
      ' ' +
      this._joins
        .map(
          (join) =>
            `${join.left ? 'LEFT JOIN' : 'JOIN'} ${join.tableName} ON ${join.condition}`,
        )
        .join(' ')
    )
  }

  protected groupByToString() {
    if (!this._group) return ''
    return ` GROUP BY ${this._group}`
  }

  protected fromToString() {
    return this.from instanceof Query ? `(${Query.toString()})` : this.from
  }

  protected sortByToString() {
    if (!this._sort) return ''
    return (
      ' ORDER BY ' +
      this._sort
        .map(({ field, desc }) => field + (desc ? ' DESC' : ''))
        .join(',')
    )
  }

  protected limitToString() {
    if (!this._limit) return ''
    if (this._limit.offset)
      return ` LIMIT ${this._limit.limit} OFFSET ${this._limit.offset}`
    return ` LIMIT ${this._limit.limit}`
  }
}
