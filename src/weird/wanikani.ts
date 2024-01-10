/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable sonarjs/no-duplicate-string */
import { readdirSync, readFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { CryptoHasher, file, write } from 'bun';
import { log } from '@/utils';
import { QuestionDTO, questionsTable } from '@/services/study/questions';
import { SubjectDTO, subjectsTable } from '@/services/study/subjects';
import { DB, UpdateTableDTO } from '@/services/db';
import { wordsTable } from '@/services/words';
import { subjectDependenciesTable } from '@/services/study/subject-dependencies';

type WKResponse<T> = {
  object: string;
  url: string;
  pages: {
    per_page: number;
    next_url?: string;
    previous_url?: string;
  };
  total_count: number;
  data_updated_at: string;
  data: WKObject<T>[];
};
type WKObject<T> = {
  id: number;
  object: string;
  url: string;
  data_updated_at: string;
  data: T;
};
type WKSubject = {
  auxiliary_meanings: {
    meaning: string;
    type: 'whitelist' | 'blacklist';
  }[];
  created_at: string;
  document_url: string;
  hidden_at?: string;
  lesson_position: number;
  level: number;
  meaning_mnemonic: string;
  meanings: {
    meaning: string;
    primary: boolean;
    accepted_answer: boolean;
  }[];
  slug: string;
  spaced_repetition_system_id: number;
};
type WKRadical = WKSubject & {
  amalgamation_subject_ids: number[];
  characters?: string;
  character_images: {
    url: string;
    content_type: 'image/png' | 'image/svg+xml';
    metadata: unknown;
    inline_styles?: boolean;
    color?: string;
    dimensions?: string;
    style_name?: string;
  }[];
};
type WKKanji = WKSubject & {
  characters: string;
  amalgamation_subject_ids: number[];
  component_subject_ids: number[];
  meaning_hint?: string;
  reading_hint?: string;
  reading_mnemonic: string;
  readings: {
    reading: string;
    primary: boolean;
    accepted_answer: boolean;
    type: 'kunyomi' | 'nanori' | 'onyomi';
  }[];
  visually_similar_subject_ids: number[];
};
type WKKana = WKSubject & {
  characters: string;
  context_sentences: {
    en: string;
    ja: string;
  }[];
  meaning_mnemonic: string;
  parts_of_speech: string[];
  pronunciation_audios: {
    url: string;
    content_type: 'audio/mpeg' | 'audio/ogg';
    metadata: {
      gender: string;
      source_id: number;
      pronunciation: string;
      voice_actor_id: number;
      voice_actor_name: string;
      voice_description: string;
    };
  }[];
};
type WKVocab = WKKana & {
  characters: string;
  component_subject_ids: number[];
  readings: {
    reading: string;
    primary: boolean;
    accepted_answer: boolean;
  }[];
  reading_mnemonic: string;
};
type WKAnySubject = WKRadical | WKKanji | WKKana | WKVocab;

// === Main logic ===
async function downloadWK() {
  const subjects: WKObject<WKAnySubject>[] = [];
  let nextUrl: string | undefined = 'https://api.wanikani.com/v2/subjects';
  while (nextUrl) {
    log(nextUrl);
    const json = (await fetch(nextUrl, {
      headers: {
        Authorization: 'Bearer ' + process.env['WK'],
      },
    }).then((x) => x.json())) as WKResponse<WKAnySubject>;
    nextUrl = json.pages.next_url;
    subjects.push(...json.data);
  }
  return subjects;
}

async function parseWK() {
  // === Loading and basic caching ===
  const subjects = (JSON.parse(readFileSync(join('assets', 'WK.json'), 'utf8')) as WKObject<WKAnySubject>[])
    .filter((x) => !x.data.hidden_at)
    .toSorted((a, b) => a.data.level * 100 + a.data.lesson_position - (b.data.level * 100 + b.data.lesson_position));
  const subjectsMap = new Map<number, WKObject<WKAnySubject>>();
  const levelDeps: number[][] = Array(60)
    .fill(0)
    .map(() => []);
  for (const subject of subjects) {
    levelDeps[subject.data.level - 1].push(subject.id);
    subjectsMap.set(subject.id, subject);
  }
  const kanjiWithStrokeOrder = new Set(readdirSync(join('assets', 'stroke_order')).map((el) => +el.slice(0, -4)));
  const pitchAccents = readFileSync(join('assets', 'accents.txt'), 'utf8')
    .split('\n')
    .map((l) => l.split('	') as [string, string, string]);
  const fileCache = new Map<string, string>(
    readFileSync(join('assets', 'WKfiles.txt'), 'utf8')
      .split('\n')
      .map((l) => l.split(' ') as [string, string]),
  );
  const filesSink = file(join('assets', 'WKfiles.txt')).writer();
  async function downloadFileAndGetHash(url: string, ext: string) {
    if (fileCache.has(url)) return fileCache.get(url)!;
    const blob = await fetch(url).then((x) => x.blob());
    const md5hasher = new CryptoHasher('md5');
    md5hasher.update(await blob.arrayBuffer());
    const name = md5hasher.digest('hex') + '.' + ext;
    await write(join('assets', 'wanikani', name), blob);
    filesSink.write(`\n${url} ${name}`);
    fileCache.set(url, name);
    return name;
  }

  // === Generating logic ===
  const subjectTag = async (subject: WKObject<WKAnySubject>, text?: string) =>
    `<subject uid="${subject.id}" title="${subject.object[0].toUpperCase() + subject.object.slice(1)}: ${
      subject.data.characters ?? subject.data.slug
    }">${
      text ??
      subject.data.characters ??
      ('character_images' in subject.data
        ? `<img class="em" src="/static/${await downloadFileAndGetHash(
            subject.data.character_images.find((x) => x.content_type === 'image/svg+xml')!.url,
            'svg',
          )}">`
        : subject.data.slug)
    }</subject>`;
  async function generateRelated(subject: WKObject<WKAnySubject>) {
    let txt = await subjectTag(subject);
    if (subject.object === 'kanji' || subject.object === 'vocabulary')
      txt += ` - ${getSubjectReadings(subject as WKObject<WKKanji | WKVocab>).join(', ')}`;
    txt += ` - ${getSubjectMeanings(subject).join(', ')}`;
    if (subject.object === 'kanji' || subject.object === 'vocabulary')
      txt += ` [${(
        await Promise.all(
          (subject as WKObject<WKKanji | WKVocab>).data.component_subject_ids.map((id) =>
            subjectTag(subjectsMap.get(id)!),
          ),
        )
      ).join('+')}]`;
    return txt;
  }
  const getSubjectMeanings = (s: WKObject<WKAnySubject>) => [
    ...s.data.meanings.filter((x) => x.accepted_answer).map((x) => x.meaning),
    ...s.data.auxiliary_meanings.filter((x) => x.type === 'whitelist').map((x) => x.meaning),
  ];
  const getSubjectReadings = (s: WKObject<WKKanji | WKVocab>) =>
    s.data.readings.filter((x) => x.accepted_answer).map((x) => x.reading);
  const parseWKDescription = (str: string) =>
    str
      .replaceAll('<radical>', '<accent>')
      .replaceAll('</radical>', '</accent>')
      .replaceAll('<kanji>', '<accent>')
      .replaceAll('</kanji>', '</accent>')
      .replaceAll('<vocabulary>', '<accent>')
      .replaceAll('</vocabulary>', '</accent>')
      .replaceAll('<reading>', '<accent>')
      .replaceAll('</reading>', '</accent>')
      .replaceAll('<meaning>', '<accent>')
      .replaceAll('</meaning>', '</accent>');

  // === Schemas ===
  const schemas: Record<string, (s: WKObject<WKAnySubject>) => string | Promise<string>> = {
    radical: () => `<tab title="Description">{{meaningDesc}}</tab><tab title="Related">{{sameMeaning}}
  
{{usedIn}}</tab>`,
    kanjiMeaning: () => `<tab title="Description">{{deps}}
{{strokeOrder}}

{{meaningDesc}}</tab><tab title="Related">{{similar}}

{{sameMeaning}}

{{usedIn}}</tab>`,
    kanjiReading: () => `<tab title="Description">{{deps}}

{{readingDesc}}</tab><tab title="Related">{{sameReading}}</tab>`,
    vocabularyMeaning: () => `<tab title="Description">{{deps}}
{{typeOfWord}}

{{meaningDesc}}</tab><tab title="Related">{{similar}}

{{sameMeaning}}</tab>`,
    vocabularyReading: () => `<tab title="Description">{{deps}}
{{pitchAccent}}
{{audio}}

{{readingDesc}}</tab><tab title="Examples">{{examples}}
Anime sentences:
<ik>{{title}}</ik></tab><tab title="Related">{{sameReading}}</tab>`,
    kana: () => `<tab title="Description">{{typeOfWord}}
{{pitchAccent}}
{{audio}}

{{meaningDesc}}</tab><tab title="Examples">{{examples}}
Anime sentences:
<ik>{{title}}</ik></tab><tab title="Related">{{sameMeaning}}</tab>`,
    meaningDesc: (s) => parseWKDescription(s.data.meaning_mnemonic),
    readingDesc: (s) => parseWKDescription((s.data as WKVocab).reading_mnemonic),
    deps: async (s) =>
      (s.data as WKKanji).component_subject_ids.length > 0
        ? `${s.object === 'kanji' ? 'Radicals' : 'Kanji'}: ${(
            await Promise.all((s.data as WKKanji).component_subject_ids.map((id) => subjectTag(subjectsMap.get(id)!)))
          ).join('+')}`
        : ``,
    similar: async (s) => {
      const sub = s as WKObject<WKKanji>;
      if (sub.data.component_subject_ids.length === 0) return '';
      const similar = subjects.filter(
        (subject) =>
          subject.id !== s.id &&
          subject.object === s.object &&
          (subject.data as WKKanji).component_subject_ids.length === sub.data.component_subject_ids.length &&
          sub.data.component_subject_ids.every((d) => (subject.data as WKKanji).component_subject_ids.includes(d)),
      );
      return similar.length > 0
        ? `<b>Similar:</b>\n${(await Promise.all(similar.map(generateRelated))).join('\n')}`
        : ``;
    },
    sameMeaning: async (s) => {
      const answers = getSubjectMeanings(s);
      const same = subjects.filter(
        (subject) =>
          subject.id !== s.id &&
          subject.object === s.object &&
          answers.some((a) => getSubjectMeanings(subject).includes(a)),
      );
      return same.length > 0
        ? `<b>Same meaning:</b>\n${(await Promise.all(same.map(generateRelated))).join('\n')}`
        : ``;
    },
    sameReading: async (s) => {
      const answers = getSubjectReadings(s as WKObject<WKKanji>);
      const same = subjects.filter(
        (subject) =>
          subject.id !== s.id &&
          subject.object === s.object &&
          answers.some((a) => getSubjectReadings(subject as WKObject<WKKanji>).includes(a)),
      );
      return same.length > 0
        ? `<b>Same reading:</b>\n${(await Promise.all(same.map(generateRelated))).join('\n')}`
        : ``;
    },
    usedIn: async (s) =>
      (s.data as WKRadical).amalgamation_subject_ids.length > 0
        ? `<b>Used in:</b>\n${(
            await Promise.all(
              (s.data as WKRadical).amalgamation_subject_ids.map((id) => subjectsMap.get(id)!).map(generateRelated),
            )
          ).join('\n')}`
        : '',
    audio: async (s) => {
      const audios = (s.data as WKVocab).pronunciation_audios.filter((x) => x.content_type === 'audio/mpeg');
      const urls = await Promise.all(audios.map((a) => downloadFileAndGetHash(a.url, 'mp3')));
      return audios
        .map((a, i) => `<audio s="/static/${urls[i]}">${a.metadata.pronunciation} (${a.metadata.gender})</audio>`)
        .join('\n');
    },
    examples: (s) =>
      (s.data as WKVocab).context_sentences.map(({ ja, en }) => `<example>${ja}\n${en}</example>`).join('\n'),
    strokeOrder: (s) => {
      if (!s.data.characters) return '';
      const code = s.data.characters.codePointAt(0)!;
      return kanjiWithStrokeOrder.has(code) ? `<img class="stroke-order" src="/static/stroke_order/${code}.svg">` : '';
    },
    typeOfWord: (s) => `Type of word: ${(s.data as WKVocab).parts_of_speech.join(', ')}`,
    pitchAccent: (s) => {
      const p =
        s.object === 'kana_vocabulary'
          ? pitchAccents.filter((p) => s.data.characters === p[0] || s.data.characters === p[1])
          : pitchAccents.filter((p) => {
              const readings = getSubjectReadings(s as WKObject<WKVocab>);
              return (
                (s.data.characters === p[0] || s.data.characters === p[1]) &&
                (p[1].length === 0 || readings.includes(p[0]) || readings.includes(p[1]))
              );
            });
      return p.length > 0
        ? `Pitch accents: ${p
            .map((x) => `<jp-pitch-accent h="${x[1]}" p="${x[2]}">${s.data.characters}<\/jp-pitch-accent>`)
            .join(', ')}`
        : '';
    },
    title: (s) => s.data.characters ?? '',
  };
  async function parseSchema(schemaName: string, subject: WKObject<WKAnySubject>): Promise<string> {
    const schema = schemas[schemaName];
    if (!schema) throw new Error(`Unknown schema: ${schemaName}`);
    let text = await schema(subject);
    for (const [a, b] of text.matchAll(/{{(.+?)}}/gs)) text = text.replace(a, await parseSchema(b, subject));
    return text;
  }

  const dbsubjects = subjectsTable.getAll('theme_id = 1').map((s) => s.id);
  log('Deleting dependencies');
  DB.prepare(
    `DELETE FROM ${subjectDependenciesTable.name}
    WHERE subject_id IN (
      SELECT id FROM ${subjectsTable.name} WHERE theme_id = ?
    )`,
  ).run(1);
  const dbMap = new Map<number, number>();
  for (const subject of subjects) {
    log(`Subject ${subject.id} ${subject.object} ${subject.data.characters ?? subject.data.slug}`);
    const s: SubjectDTO = {
      themeId: 1,
      srsId: 1,
      title: '',
    };
    const qs: UpdateTableDTO<QuestionDTO>[] = [];
    const descriptions: string[] = [];
    const sameTitle = subjects.filter((s) => s.data.characters === subject.data.characters && s.id !== subject.id);
    const meanings = getSubjectMeanings(subject);
    const alternateMeanings = sameTitle.flatMap(getSubjectMeanings).filter((a) => !meanings.includes(a));
    switch (subject.object) {
      case 'vocabulary':
        const vocabulary = subject as WKObject<WKVocab>;
        s.title = `Vocabulary ${vocabulary.data.characters}`;
        const readings = getSubjectReadings(vocabulary);
        const alternateReadings = sameTitle
          .filter((s) => s.object === 'vocabulary' || s.object === 'kanji')
          .flatMap((s) => getSubjectReadings(s as WKObject<WKVocab>))
          .filter((a) => !meanings.includes(a));
        qs.push({
          answers: meanings,
          descriptionWordId: -1,
          question: `Vocabulary meaning:\n<accent>${s.title.slice(11)}</accent>`,
          subjectId: -1,
          alternateAnswers:
            alternateMeanings.length === 0
              ? null
              : Object.fromEntries(alternateMeanings.map((a) => [a, `Please type vocabulary meaning`])),
        });
        descriptions.push(await parseSchema('vocabularyMeaning', vocabulary));
        qs.push({
          answers: readings,
          descriptionWordId: -1,
          question: `Vocabulary reading:\n<accent>${s.title.slice(11)}</accent>`,
          subjectId: -1,
          alternateAnswers:
            alternateReadings.length === 0
              ? null
              : Object.fromEntries(alternateReadings.map((a) => [a, `Please type vocabulary reading`])),
        });
        descriptions.push(await parseSchema('vocabularyReading', vocabulary));
        break;
      case 'kana_vocabulary':
        const kana = subject as WKObject<WKKana>;
        s.title = `Kana vocabulary ${kana.data.characters}`;
        qs.push({
          answers: meanings,
          descriptionWordId: -1,
          question: `Kana vocabulary meaning:\n<accent>${s.title.slice(16)}</accent>`,
          subjectId: -1,
          alternateAnswers:
            alternateMeanings.length === 0
              ? null
              : Object.fromEntries(alternateMeanings.map((a) => [a, `Please type vocabulary meaning`])),
        });
        descriptions.push(await parseSchema('kana', kana));
        break;
      case 'kanji':
        const kanji = subject as WKObject<WKKanji>;
        s.title = `Kanji ${kanji.data.characters}`;
        const readings2 = getSubjectReadings(kanji);
        const alternateReadings2 = sameTitle
          .filter((s) => s.object === 'vocabulary' || s.object === 'kanji')
          .flatMap((s) => getSubjectReadings(s as WKObject<WKVocab>))
          .filter((a) => !meanings.includes(a));
        qs.push({
          answers: meanings,
          descriptionWordId: -1,
          question: `Kanji meaning:\n<accent>${s.title.slice(6)}</accent>`,
          subjectId: -1,
          alternateAnswers:
            alternateMeanings.length === 0
              ? null
              : Object.fromEntries(alternateMeanings.map((a) => [a, `Please type kanji meaning`])),
        });
        descriptions.push(await parseSchema('kanjiMeaning', kanji));
        qs.push({
          answers: readings2,
          descriptionWordId: -1,
          question: `Kanji reading:\n<accent>${s.title.slice(6)}</accent>`,
          subjectId: -1,
          alternateAnswers:
            alternateReadings2.length === 0
              ? null
              : Object.fromEntries(alternateReadings2.map((a) => [a, `Please type kanji reading`])),
        });
        descriptions.push(await parseSchema('kanjiReading', kanji));
        break;
      case 'radical':
        const radical = subject as WKObject<WKRadical>;
        if (radical.data.characters) s.title = `Radical ${radical.data.characters}`;
        else
          s.title = `Radical <img class="em" src="/static/${await downloadFileAndGetHash(
            radical.data.character_images.find((x) => x.content_type === 'image/svg+xml')!.url,
            'svg',
          )}">`;
        qs.push({
          answers: meanings,
          descriptionWordId: -1,
          question: `Radical meaning:\n<accent>${s.title.slice(8)}</accent>`,
          subjectId: -1,
          alternateAnswers:
            alternateMeanings.length === 0
              ? null
              : Object.fromEntries(alternateMeanings.map((a) => [a, `Please type radical meaning`])),
        });
        descriptions.push(await parseSchema('radical', radical));
        break;
    }

    // === DB ===
    const idReplaces = new Map<number, number>([
      // [3867, 2590],
      // [7357, 7674],
    ]);
    let id =
      idReplaces.get(subject.id) ??
      DB.prepare<{ id: number }, [string]>(`SELECT id FROM ${subjectsTable.name} WHERE title = ?`).get(s.title)?.id;
    // === find subject by description ===
    if (!id && ![9238].includes(subject.id)) {
      const q = questionsTable.convertFrom(
        DB.prepare(`SELECT * FROM ${questionsTable.name} WHERE answers = ? AND question LIKE ?`).get(
          getSubjectMeanings(subject).join('|'),
          qs[0].question!.slice(0, 5) + '%',
        ),
      )!;
      if (q) {
        id = q.subjectId;
        // log(
        //   `[CREATION ABORTED] Found subject  hard-way ${subject.id} - ${id} | ${subject.data.characters} - ${
        //     subjectsTable.get(id)!.title
        //   }`,
        // );
      }
    }
    if (id) {
      subjectsTable.update(id, s);
      dbsubjects.splice(dbsubjects.indexOf(id), 1);
    } else {
      throw new Error('It must exist');
      //log(`[CREATING SUBJECT] ${subject.id} ${s.title}`);
      // subjectsTable.create(s);
      // id = lastInsertRowIdQuery.get()!.id;
    }
    dbMap.set(subject.id, id);
    const dbqs = questionsTable.getBySubject(id);
    if (dbqs.length > qs.length) throw new Error('DBQS is larger than needed');
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      const dbq = dbqs[i];
      q.subjectId = id;
      const word = descriptions[i];
      if (dbq) {
        q.descriptionWordId = dbq.descriptionWordId;
        wordsTable.update(dbq.descriptionWordId, {
          word,
        });
        questionsTable.update(dbq.id, q);
      } else {
        //log(`[CREATING QUESTION] ${i ? 'Meaning' : 'Reading'}`);
        if (subject.id < 9124) {
          log(id, s, q, questionsTable.getBySubject(id), subject);
          throw new Error('It must exist');
        }
        q.descriptionWordId = wordsTable.create({
          word,
        });
        questionsTable.create(q as QuestionDTO);
      }
    }
  }
  // === Replace subject ids ===
  log('Fixing stuff in words...');
  const words = DB.prepare(
    `SELECT w.id, w.word FROM ${wordsTable.name} w
JOIN ${questionsTable.name} q ON q.description_word_id = w.id
JOIN ${subjectsTable.name} s ON s.id = q.subject_id
WHERE s.theme_id = 1
  `,
  )
    .all()
    .map((x) => wordsTable.convertFrom(x)!);
  for (const word of words) {
    log(word.id);
    wordsTable.update(word.id, {
      word: word.word
        // Subject ids only known after all updates so we fix them now
        .replaceAll(/<subject uid="(\d+?)"/g, (_, id) => `<subject uid="${dbMap.get(parseInt(id as string))}"`)
        // Remove empty tags
        .replaceAll(/<(.+?) title=".+?">\s+?<\/\1>/g, ''),
    });
  }

  // === Dependenices ===
  log('Creating deps...');
  for (const subject of subjects) {
    const id = dbMap.get(subject.id)!;
    if (subject.data.level > 1)
      for (const dep of levelDeps[subject.data.level - 2])
        subjectDependenciesTable.create({ dependencyId: dbMap.get(dep)!, percent: 90, subjectId: id });
    if ('component_subject_ids' in subject.data)
      for (const dep of subject.data.component_subject_ids)
        subjectDependenciesTable.create({ dependencyId: dbMap.get(dep)!, percent: 100, subjectId: id });
  }
  log(`Unused subjects: ${dbsubjects.length} ${dbsubjects.join(', ')}`);
  await filesSink.end();
  cpSync(join('assets', 'wanikani'), join('static', 'static'), {
    recursive: true,
  });
  cpSync(join('assets', 'stroke_order'), join('static', 'static', 'stroke_order'), {
    recursive: true,
  });
}

// eslint-disable-next-line @typescript-eslint/no-misused-promises, @typescript-eslint/require-await
setTimeout(async () => {
  log('Generating...');
  //await write(join('assets', 'WK.json'), JSON.stringify(await downloadWK(), undefined, 2));
  await parseWK();
  log('Done...');
  process.exit();
}, 3000);
