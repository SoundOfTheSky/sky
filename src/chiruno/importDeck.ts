import { spawnSync } from 'bun';
import { Database } from 'bun:sqlite';
import { cpSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';

import { furiganaToRuby } from '@/chiruno/utils';
import { DB, DBRow, lastInsertRowIdQuery } from '@/services/db';
import { questionsTable } from '@/services/study/questions';
import { subjectDependenciesTable } from '@/services/study/subject-dependencies';
import { subjectsTable } from '@/services/study/subjects';
import { themesTable } from '@/services/study/themes';

console.log('Unzipping...');
spawnSync({
  cmd: ['unzip', 'ru_en.apkg', '-d', 'deck'],
  cwd: join('assets'),
});
const media = new Map(
  Object.entries(JSON.parse(readFileSync(join('assets', 'deck', 'media'), 'utf8')) as Record<string, string>).map(
    ([k, v]) => [v, k],
  ),
);
const db = new Database(join('assets', 'deck', 'collection.anki21'), {
  create: false,
  readonly: true,
});
console.log('Loading data...');
const data = db
  .prepare<{ flds: string }, []>('SELECT flds FROM notes')
  .all()
  .map((x) => x.flds.split('\u001f'));
themesTable.create({
  title: 'RU-EN',
});
const themeId = lastInsertRowIdQuery.get()!.id;
//const themeId = 4;
const subjectIds: number[] = [];
/** CORE 6k
 * 0 - kanji
 * 1 - furigana
 * 2 - kana
 * 3 - english
 * 4 - audio
 * 5 - type?
 * 6 - caution?
 * 7 - example
 * 8 - example furigana
 * 9 - example kana
 * 10 - example english
 * 11 - example closed
 * 12 - example audio
 * 13 - image
 * 14 - notes
 * 15 - core-index
 * 16 - voc-index main
 * 17 - Sent-index
 * 18 - tags?
 */
/** RU_EN
 * 0 - порядок?
 * 1 - другой язык?
 * 2 - Русский
 * 3 - Английский
 * 4 - Куча примеров
 * 5 - Звук
 * 6 - Короткий пример без перевода
 * 7 - Куча примеров без перевода
 * 8 - Те же примеры с пропуском слова
 * 9 - Бред какой-то
 * 10 - Снова пример с пропуском
 * 11 - Значения на английском глагол
 * 12 - Чтение письменно
 * 13 - Чтение звук
 * 14 - Значения на английском существительное
 * 15 - ?
 * 16 - ?
 * 17 - синонимы
 * 18 - разные формы
 * 19 - ?
 * 20 - Разные формы во времени
 * 21 - Примеры англ
 * 22 - примеры англ
 * 23 - ?
 * 24 - картинка
 * 25 - хз
 * 26 - пример
 * 27 - объяснение англ
 * 28 - объяснение англ
 */
const q1 = DB.prepare<DBRow, [string]>(`SELECT * FROM ${questionsTable.name} WHERE question = ?`);
for (let i = 0; i < data.length; i++) {
  const card = data[i];
  console.log(i, card[0]);
  // If same question allow the first one
  if (data.some((card2, i2) => i2 < i && card2[7] === card[7])) {
    console.log('Skip!');
    continue;
  }
  subjectsTable.create({
    srsId: 2,
    themeId,
    title: card[0],
  });
  const subjectId = lastInsertRowIdQuery.get()!.id;
  subjectIds.push(subjectId);
  // const existingQuestion = questionsTable.convertFrom(q1.get(card[7]));
  // if (!existingQuestion) throw new Error('Question not found!');
  // const subjectId = existingQuestion.subjectId;
  const media4 = card[4] && media.has(card[4].slice(7, -1)) && card[4].slice(7, -1);
  const media12 = card[12] && media.has(card[12].slice(7, -1)) && card[12].slice(7, -1);
  questionsTable.create({
    subjectId,
    description: `<tab title="Description">Word: ${card[0]}
Type: ${card[5]}
Reading: ${card[2]}
Meaning: ${card[3]}${media4 ? `\n<audio s="/static/${media4}">Pronunciation</audio>` : ''}

<example>${furiganaToRuby(card[8]).replaceAll(' ', '')}
${card[10]}</example>${media12 ? `\n<audio s="/static/${media12}">Sentence</audio>` : ''}</tab>`,
    answers: ['Correct', 'Wrong'],
    question: card[7],
    choose: true,
  });
  if (media4) cpSync(join('assets', 'deck', media.get(media4)!), join('static', 'static', media4));
  if (media12) cpSync(join('assets', 'deck', media.get(media12)!), join('static', 'static', media12));
}
// Deps in batches
const BATCH = 25;
console.log('Generating dependencies');
for (let i = BATCH; i < subjectIds.length; i++)
  for (let i2 = i - BATCH - (i % BATCH); i2 < i - (i % BATCH); i2++)
    subjectDependenciesTable.create({
      percent: 90,
      subjectId: subjectIds[i],
      dependencyId: subjectIds[i2],
    });
rmSync(join('assets', 'deck'), {
  recursive: true,
});
console.log('Done');
