import { join } from 'path';
import { readFileSync, cpSync, rmSync } from 'fs';
import { Database } from 'bun:sqlite';
import { subjectsTable } from '@/services/study/subjects';
import { themesTable } from '@/services/study/themes';
import { lastInsertRowIdQuery } from '@/services/db';
import { questionsTable } from '@/services/study/questions';
import { wordsTable } from '@/services/words';
import { subjectDependenciesTable } from '@/services/study/subject-dependencies';
import { spawnSync } from 'bun';

console.log('Unzipping...');
spawnSync({
  cmd: ['unzip', 'deck.apkg', '-d', 'deck'],
  cwd: import.meta.dir,
});
const media = new Map(
  Object.entries(
    JSON.parse(readFileSync(join(import.meta.dir, 'deck', 'media'), 'utf8')) as Record<string, string>,
  ).map(([k, v]) => [v, k]),
);
const db = new Database(join(import.meta.dir, 'deck', 'collection.anki2'), {
  create: false,
  readwrite: true,
});
console.log('Loading data...');
const data = db
  .prepare<{ flds: string }, []>('SELECT flds FROM notes')
  .all()
  .map((x) => x.flds.split('\u001f'));
themesTable.create({
  title: 'JP Core2k',
});
const themeId = lastInsertRowIdQuery.get()!.id;
const subjectIds: number[] = [];
for (const card of data) {
  console.log(card[0], card[1]);
  if (data.some((y) => parseInt(y[0]) < parseInt(card[0]) && y[1] === card[1])) {
    console.log('Skip!');
    continue;
  }
  subjectsTable.create({
    srsId: 1,
    themeId,
    title: card[1],
  });
  const subjectId = lastInsertRowIdQuery.get()!.id;
  subjectIds.push(subjectId);
  if (card[1] !== card[3]) {
    wordsTable.create({
      word: `<tab title="Description"></tab>`,
    });
    const descriptionWordId = lastInsertRowIdQuery.get()!.id;
    questionsTable.create({
      subjectId,
      descriptionWordId,
      answers: card[3].split(', '),
      question: `Reading:\n${card[1]}`,
    });
  }
  wordsTable.create({
    word: `<tab title="Description">Word type: ${card[6]}
${card[5] ? `<audio s="/static/${card[5].slice(7, -1)}">${card[2]}</audio>` : ''}
<example>${card[8]}
${card[11]}</example>
${card[13] ? `<audio s="/static/${card[13].slice(7, -1)}">${card[10]}</audio>` : ''}
</tab>`,
  });
  const descriptionWordId = lastInsertRowIdQuery.get()!.id;
  questionsTable.create({
    subjectId,
    descriptionWordId,
    answers: card[4].split(', '),
    question: `Translation:\n${card[1]}`,
  });
  if (card[5])
    cpSync(
      join(import.meta.dir, 'deck', media.get(card[5].slice(7, -1))!),
      join('static', 'static', card[5].slice(7, -1)),
    );
  if (card[13])
    cpSync(
      join(import.meta.dir, 'deck', media.get(card[13].slice(7, -1))!),
      join('static', 'static', card[13].slice(7, -1)),
    );
}
// Deps in batches
const BATCH = 10;
console.log('Generating dependencies');
for (let i = BATCH; i < subjectIds.length; i++)
  for (let i2 = i - BATCH - (i % BATCH); i2 < i - (i % BATCH); i2++)
    subjectDependenciesTable.create({
      percent: 90,
      subjectId: subjectIds[i],
      dependencyId: subjectIds[i2],
    });
rmSync(join(import.meta.dir, 'deck'), {
  recursive: true,
});
console.log('Done');
