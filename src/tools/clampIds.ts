/* eslint-disable unused-imports/no-unused-vars */
import { DB } from '@/services/db/db';
import TABLES from '@/services/tables';
import { log } from 'sky-utils';

const tables = [
  TABLES.USERS,
  TABLES.STORE,
  TABLES.STUDY_ANSWERS,
  TABLES.STUDY_QUESTIONS,
  TABLES.STUDY_THEMES,
  TABLES.STUDY_USERS_QUESTIONS,
  TABLES.STUDY_USERS_SUBJECTS,
  TABLES.STUDY_USERS_THEMES,
];

function orderIds(
  table: string,
  ids: number[],
  changeId?: (from: number, to: number) => unknown,
) {
  const changeIdQuery = DB.prepare(`UPDATE ${table} SET id = ? WHERE id = ?`);
  log('Clamping', table);
  for (let i = 0; i < ids.length; i++)
    changeIdQuery.run(i + 1000000001, ids[i]!);
  for (let i = 0; i < ids.length; i++) {
    changeIdQuery.run(i + 1, i + 1000000001);
    changeId?.(ids[i]!, i + 1);
  }
  DB.prepare(`UPDATE sqlite_sequence SET seq = ? WHERE name = ?`).run(
    ids.length,
    table,
  );
}

log('Starting to clamp...');
// for (const table of tables)
//   orderIds(
//     table,
//     DB.prepare<{ id: number }, []>(`SELECT * FROM ${table} ORDER BY id ASC`)
//       .all()
//       .map((x) => x.id),
//   );

// orderIds(
//   TABLES.STUDY_SUBJECTS,
//   DB.prepare<{ id: number }, []>(`SELECT * FROM ${TABLES.STUDY_SUBJECTS} ORDER BY theme_id ASC, id ASC`)
//     .all()
//     .map((x) => x.id),
//   (from, to) => {
//     for (const question of questionsTable.convertFromMany(
//       questionsTable.query
//         .clone()
//         .where<{ description: string }>('description LIKE ?')
//         .toDBQuery()
//         .all({ description: `%<subject uid="${from}"%` }),
//     ))
//       questionsTable.update(question.id, {
//         description: question.description.replaceAll(`<subject uid="${from}"`, `<subject uid="${to}"`),
//       });
//   },
// );

console.log(
  DB.prepare<{ id: number }, []>(
    `SELECT * FROM ${TABLES.STUDY_SUBJECTS} ORDER BY theme_id ASC, id ASC`,
  )
    .all()
    .map((x) => x.id)
    .join('\n'),
);
console.log('Done');
process.exit();
