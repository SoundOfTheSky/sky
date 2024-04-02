/* eslint-disable unused-imports/no-unused-vars */
import { spawnSync } from 'bun';
import { Database } from 'bun:sqlite';
import { readFileSync, rmSync } from 'fs';
import { join } from 'path';

import { furiganaToRuby } from '@/chiruno/utils';
import { lastInsertRowIdQuery } from '@/services/db';
import { questionsTable } from '@/services/study/questions';
import { subjectDependenciesTable } from '@/services/study/subject-dependencies';
import { subjectsTable } from '@/services/study/subjects';
import { themesTable } from '@/services/study/themes';
import { wordsTable } from '@/services/words';

console.log('Unzipping...');
spawnSync({
  // === File name ===
  cmd: ['unzip', 'minna_no_nihongo.apkg', '-d', 'deck'],
  cwd: join('assets'),
});
const media = new Map(
  Object.entries(JSON.parse(readFileSync(join('assets', 'deck', 'media'), 'utf8')) as Record<string, string>).map(
    ([k, v]) => [v, k],
  ),
);
const db = new Database(join('assets', 'deck', 'collection.anki2'), {
  create: false,
  readwrite: true,
});
console.log('Loading data...');
const data = db
  .prepare<{ flds: string }, []>('SELECT flds FROM notes')
  .all()
  .map((x) => x.flds.split('\u001f'));
themesTable.create({
  // === Theme name ===
  title: 'みんなの日本語',
});
const themeId = lastInsertRowIdQuery.get()!.id;
/**
 * 0 - Question - 会社員company employee会社[かいしゃ] 員[いん]1
 * 1 - Answers - company employee, jjj(aaa)
 * 2 - Reading - 会社[かいしゃ] 員[いん] (или просто хирагана)
 * 3 - Lesson - 5
 */
const indexToId = new Map<number, number>();
for (let i = 0; i < data.length; i++) {
  const card = data[i];
  console.log(card[3], card[0], card[1]);
  // If same question allow the first one
  if (data.some((card2, i2) => i2 < i && card2[0] === card[0])) {
    console.log('Skip!');
    continue;
  }
  subjectsTable.create({
    srsId: 1,
    themeId,
    title: card[0],
  });
  const subjectId = lastInsertRowIdQuery.get()!.id;
  indexToId.set(i, subjectId);
  const descriptionWordId = wordsTable.create({
    word: `<tab title="Description">Reading: ${furiganaToRuby(card[2])}
Meaning: ${card[1]}</tab>`,
  });
  questionsTable.create({
    subjectId,
    descriptionWordId,
    answers: ['Correct', 'Wrong'],
    question: '日本語: ' + card[0],
    choose: true,
  });
  // === Find links in card and copy media ===
  // if (card[5])
  //   cpSync(join('assets', 'deck', media.get(card[5].slice(7, -1))!), join('static', 'static', card[5].slice(7, -1)));
  // if (card[13])
  //   cpSync(join('assets', 'deck', media.get(card[13].slice(7, -1))!), join('static', 'static', card[13].slice(7, -1)));
}
console.log('Generating dependencies');
for (let i = 0; i < data.length; i++) {
  const lesson = parseInt(data[i][3]);
  if (lesson === 1) continue;
  const id = indexToId.get(i);
  if (!id) continue;
  for (let i2 = 0; i2 < data.length; i2++) {
    if (i2 === i) continue;
    const lesson2 = parseInt(data[i2][3]);
    if (lesson2 !== lesson - 1) continue;
    const id2 = indexToId.get(i2);
    if (!id2) continue;
    subjectDependenciesTable.create({
      percent: 90,
      subjectId: id,
      dependencyId: id2,
    });
  }
}
// Deps in batches
// const BATCH = 10;
// for (let i = BATCH; i < subjectIds.length; i++)
//   for (let i2 = i - BATCH - (i % BATCH); i2 < i - (i % BATCH); i2++)
//     subjectDependenciesTable.create({
//       percent: 90,
//       subjectId: subjectIds[i],
//       dependencyId: subjectIds[i2],
//     });

rmSync(join('assets', 'deck'), {
  recursive: true,
});
console.log('Done');
