import { log } from '@softsky/utils'

import { database } from '@/services/db/database'
import { questionsTable } from '@/services/study/questions'
import TABLES from '@/services/tables'

const tables = [
  TABLES.USERS,
  TABLES.STORE,
  TABLES.STUDY_ANSWERS,
  TABLES.STUDY_QUESTIONS,
  TABLES.STUDY_THEMES,
  TABLES.STUDY_USERS_QUESTIONS,
  TABLES.STUDY_USERS_SUBJECTS,
  TABLES.STUDY_USERS_THEMES,
]

function orderIds(
  table: string,
  ids: number[],
  changeId?: (from: number, to: number) => unknown,
) {
  const changeIdQuery = database.prepare(`UPDATE ${table} SET id = ? WHERE id = ?`)
  log('Clamping', table)
  for (let index = 0; index < ids.length; index++) {
    console.log(table, 1, index)
    changeIdQuery.run(index + 1_000_000_001, ids[index]!)
  }
  for (let index = 0; index < ids.length; index++) {
    console.log(table, 2, index)
    changeIdQuery.run(index + 1, index + 1_000_000_001)
    changeId?.(ids[index]!, index + 1)
  }
  database.prepare(`UPDATE sqlite_sequence SET seq = ? WHERE name = ?`).run(
    ids.length,
    table,
  )
}

log('Starting to clamp...')
for (const table of tables)
  orderIds(
    table,
    database.prepare<{ id: number }, []>(`SELECT * FROM ${table} ORDER BY id ASC`)
      .all()
      .map(x => x.id),
  )

orderIds(
  TABLES.STUDY_SUBJECTS,
  database.prepare<{ id: number }, []>(`SELECT * FROM ${TABLES.STUDY_SUBJECTS} ORDER BY theme_id ASC, id ASC`)
    .all()
    .map(x => x.id),
  (from, to) => {
    console.log(to)
    for (const question of questionsTable.convertFromMany(
      questionsTable.query
        .clone()
        .where<{ description: string }>('description LIKE $description')
        .toDBQuery()
        .all({ description: `%<subject uid="${from}"%` }),
    ))
      questionsTable.update(question.id, {
        description: question.description.replaceAll(`<subject uid="${from}"`, `<subject uid="${to}"`),
      })
  },
)

console.log('Done')
// eslint-disable-next-line unicorn/no-process-exit
process.exit()
