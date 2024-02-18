import { DB } from '@/services/db';
import { usersTable } from '@/services/session/user';
import { storeTable } from '@/services/store';
import { questionsTable } from '@/services/study/questions';
import { srsTable } from '@/services/study/srs';
import { subjectDependenciesTable } from '@/services/study/subject-dependencies';
import { subjectsTable } from '@/services/study/subjects';
import { themesTable } from '@/services/study/themes';
import { usersAnswersTable } from '@/services/study/users-answers';
import { usersQuestionsTable } from '@/services/study/users-questions';
import { usersSubjectsTable } from '@/services/study/users-subjects';
import { usersThemesTable } from '@/services/study/users-themes';
import { wordsTable } from '@/services/words';

const tables = [
  usersTable.name,
  wordsTable.name,
  subjectDependenciesTable.name,
  questionsTable.name,
  srsTable.name,
  storeTable.name,
  themesTable.name,
  usersAnswersTable.name,
  usersQuestionsTable.name,
  usersSubjectsTable.name,
  usersThemesTable.name,
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
const ids = DB.prepare<{ id: number }, []>(`SELECT id FROM ${subjectsTable.name} ORDER BY id asc`)
  .all()
  .map((x) => x.id);
for (let i = 0; i < ids.length; i++) {
  console.log(i, ids.length);
  if (i + 1 === ids[i]) continue;
  DB.prepare(`UPDATE ${subjectsTable.name} SET id = ? WHERE id = ?`).run(i + 1, ids[i]);
  for (const word of DB.prepare(`SELECT * FROM ${wordsTable.name} WHERE word LIKE ?`)
    .all(`<subject uid="${ids[i]}"`)
    .map((x) => wordsTable.convertFrom(x)!)) {
    wordsTable.update(word.id, {
      word: word.word.replaceAll(`<subject uid="${ids[i]}"`, `<subject uid="${i + 1}"`),
    });
  }
}
DB.prepare(`UPDATE sqlite_sequence SET seq = ? WHERE name = ?`).run(ids.length, subjectsTable.name);

console.log('Done');
process.exit();
