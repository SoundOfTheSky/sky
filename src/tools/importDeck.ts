import { spawnSync } from 'bun';
import { Database } from 'bun:sqlite';
import { cpSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';

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
  Object.entries(
    JSON.parse(readFileSync(join('assets', 'deck', 'media'), 'utf8')) as Record<
      string,
      string
    >,
  ).map(([k, v]) => [v, k]),
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
const themeId = themesTable.create({
  title: 'RU-EN',
}).lastInsertRowid as number;
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
 * 5 - Звук для следующего короткого примера
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
for (let i = 0; i < data.length; i++) {
  const card = data[i]!;
  console.log(i, card[0]!);
  // If same question allow the first one
  if (data.some((card2, i2) => i2 < i && card2[3] === card[3]!)) {
    console.log('Skip!');
    continue;
  }
  const subjectId = subjectsTable.create({
    themeId,
    title: card[3]!,
  }).lastInsertRowid as number;
  subjectIds.push(subjectId);
  // const existingQuestion = questionsTable.convertFrom(q1.get(card[7]!));
  // if (!existingQuestion) throw new Error('Question not found!');
  // const subjectId = existingQuestion.subjectId;
  const media13 =
    card[13]! && media.has(card[13].slice(7, -1)) && card[13].slice(7, -1);
  const media24 =
    card[24]! && media.has(card[24].slice(10, -2)) && card[24].slice(10, -2);
  questionsTable.create({
    subjectId,
    description: `<tab title="Описание">Слово: ${card[3]!}${media13 ? `\n<audio s="/static/${media13}">Чтение: ${card[12]!}</audio>` : ''}
Перевод: ${card[2]!}${media24 ? `\n<img src="/static/${media24}">` : ''}
</tab><tab title="Примеры">${card[4]!
      .replaceAll('<font color="#000000">', '')
      .replaceAll('<font color="#008000">', '')
      .replaceAll('</font>', '')
      .replaceAll(card[3]!, `<accent>${card[3]!}</accent>`)
      .split('<br>')
      .map((x) => `<example>${x.replaceAll(' - ', '\n')}</example>`)
      .join('\n')}</tab>`,
    answers: card[2]!.split('; ').map((x) => x.trim()),
    question: card[3]!,
    choose: true,
  });
  if (media13)
    cpSync(
      join('assets', 'deck', media.get(media13)!),
      join('static', 'static', media13),
    );
  if (media24)
    cpSync(
      join('assets', 'deck', media.get(media24)!),
      join('static', 'static', media24),
    );
}
// Deps in batches
const BATCH = 50;
console.log('Generating dependencies');
for (let i = BATCH; i < subjectIds.length; i++)
  for (let i2 = i - BATCH - (i % BATCH); i2 < i - (i % BATCH); i2++)
    subjectDependenciesTable.create({
      percent: 90,
      subjectId: subjectIds[i]!,
      dependencyId: subjectIds[i2]!,
    });
rmSync(join('assets', 'deck'), {
  recursive: true,
});
console.log('Done');
