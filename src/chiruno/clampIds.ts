import { DB } from '@/services/db/db';
import { questionsTable } from '@/services/study/questions';
import TABLES from '@/services/tables';

const tables = [
  TABLES.AUTHENTICATORS,
  TABLES.USERS,
  TABLES.STORE,
  TABLES.STUDY_ANSWERS,
  TABLES.STUDY_QUESTIONS,
  TABLES.STUDY_SUBJECTS,
  TABLES.STUDY_THEMES,
  TABLES.STUDY_USERS_QUESTIONS,
  TABLES.STUDY_USERS_SUBJECTS,
  TABLES.STUDY_USERS_THEMES,
];
console.log('Starting to clamp...');
for (const table of tables) {
  console.log('Clamping', table);
  const ids = DB.prepare<{ id: number }, []>(`SELECT id FROM ${table} ORDER BY id asc`)
    .all()
    .map((x) => x.id);
  for (let i = 0; i < ids.length; i++) {
    if (i + 1 === ids[i]) continue;
    DB.prepare(`UPDATE ${table} SET id = ? WHERE id = ?`).run(i + 1, ids[i]);
  }
  DB.prepare(`UPDATE sqlite_sequence SET seq = ? WHERE name = ?`).run(ids.length, table);
}

// === Subjects ===
console.log('Clamping subjects');
const ids = DB.prepare<{ id: number }, []>(`SELECT id FROM ${TABLES.STUDY_SUBJECTS} ORDER BY id asc`)
  .all()
  .map((x) => x.id);
for (let i = 0; i < ids.length; i++) {
  console.log(i, ids.length);
  if (i + 1 === ids[i]) continue;
  DB.prepare(`UPDATE subjects SET id = ? WHERE id = ?`).run(i + 1, ids[i]);
  for (const question of questionsTable.convertFromMany(
    questionsTable.query
      .clone()
      .where<{ description: string }>('description LIKE ?')
      .toDBQuery()
      .all({ description: `%<subject uid="${ids[i]}"%` }),
  )) {
    questionsTable.update(question.id, {
      description: question.description.replaceAll(`<subject uid="${ids[i]}"`, `<subject uid="${i + 1}"`),
    });
  }
}
DB.prepare(`UPDATE sqlite_sequence SET seq = ? WHERE name = ?`).run(ids.length, 'subjects');

console.log('Done');
process.exit();
