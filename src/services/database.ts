import {
  Collection,
  MongoClient,
  OptionalUnlessRequiredId,
  ServerApiVersion,
} from 'mongodb'

import {
  DatabaseConnector,
  DefaultSchema,
  QueryKeys,
} from '@/sky-shared/database'

const client = new MongoClient('mongodb://127.0.0.1:27017', {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})
await client.connect()
export const DB = client.db('sky')
await DB.command({ ping: 1 })

export class MongoDatabaseConnector<T extends DefaultSchema>
  implements DatabaseConnector<T>
{
  public collection

  public constructor(protected name: string) {
    this.collection = DB.collection<T>(name)
  }

  public async get(_id: string): Promise<T | undefined> {
    return (this.collection as unknown as Collection<DefaultSchema>).findOne({
      _id,
    }) as Promise<T | undefined>
  }

  public async create(data: T): Promise<void> {
    await this.collection.insertOne(data as OptionalUnlessRequiredId<T>)
  }

  public async createMany(data: T[]): Promise<void> {
    await this.collection.insertMany(data as OptionalUnlessRequiredId<T>[])
  }

  public async delete(_id: string): Promise<void> {
    await (this.collection as unknown as Collection<DefaultSchema>).deleteOne({
      _id,
    })
  }

  public async deleteMany(query: QueryKeys<T>): Promise<void> {
    await (this.collection as unknown as Collection<DefaultSchema>).deleteMany(
      this.buildFilter(query),
    )
  }

  public async *cursor(query: QueryKeys<T>): AsyncGenerator<T> {
    for await (const element of this.collection.find(this.buildFilter(query)))
      yield element as T
  }

  public getAll(query: QueryKeys<T>): Promise<T[]> {
    return this.collection.find(this.buildFilter(query)).toArray() as Promise<
      T[]
    >
  }

  public async update(_id: string, fields: Partial<T>): Promise<void> {
    await (this.collection as unknown as Collection<DefaultSchema>).updateOne(
      { _id },
      fields,
    )
  }

  public async updateMany(
    query: QueryKeys<T>,
    fields: Partial<T>,
  ): Promise<void> {
    await (this.collection as unknown as Collection<DefaultSchema>).updateMany(
      this.buildFilter(query),
      fields,
    )
  }

  private buildFilter(query: QueryKeys<T>) {
    const filter: Record<string, any> = {}
    for (const key in query) {
      const field = key.slice(0, -1)
      const modifier = key.at(-1)!
      if (modifier === '=') filter[field] = query[key]
      else {
        filter[field] ??= {}
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        filter[field][modifier === '<' ? '$lte' : '$gte'] = query[key]
      }
    }
    return filter
  }
}
