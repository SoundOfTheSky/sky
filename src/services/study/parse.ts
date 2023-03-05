/* eslint-disable sonarjs/no-duplicate-string */
/* eslint-disable sonarjs/no-nested-template-literals */
/* eslint-disable sonarjs/cognitive-complexity */
import got from 'got';
import { readFile } from 'node:fs/promises';
import type { TableDTO } from '../../db';
import { log } from '../../utils';
import { wordsTable } from '../words';
import { Question, questionsTable } from './questions';
import { srsTable } from './srs';
import { subjectDependenciesTable } from './subject-dependencies';
import { subjectsTable } from './subjects';
import { themesTable } from './themes';
type WaniKaniResponse<T> = {
  object: string;
  url: string;
  pages: {
    per_page: number;
    next_url: string | null;
    previous_url: string | null;
  };
  total_count: number;
  data_updated_at: string;
  data: T[];
};
type WaniKaniObject<T> = {
  id: number;
  object: string;
  url: string;
  data_updated_at: string;
  data: T;
};
type WaniKaniSubjectCommon = {
  auxiliary_meanings: {
    meaning: string;
    type: 'whitelist' | 'blacklist';
  }[];
  characters: string;
  created: string;
  document_url: string;
  hidden_at: string | null;
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
type WaniKaniRadical = WaniKaniSubjectCommon & {
  amalgamation_subject_ids: number[];
  characters: string | null;
  character_images: {
    url: string;
    metadata?: Record<string, string | boolean>;
    content_type: string;
  }[];
};
type WaniKaniKanji = WaniKaniSubjectCommon & {
  amalgamation_subject_ids: number[];
  component_subject_ids: number[]; // these must have passed assignments
  reading_mnemonic: string;
  meaning_hint: string | null;
  reading_hint: string | null;
  readings: {
    reading: string;
    primary: boolean;
    accepted_answer: boolean;
    type: 'kunyomi' | 'nanori' | 'onyomi';
  }[];
  visually_similar_subject_ids: number[];
};
type WaniKaniVocabulary = WaniKaniSubjectCommon & {
  component_subject_ids: number[]; // these must have passed assignments
  context_sentences: {
    en: string;
    ja: string;
  }[];
  reading_mnemonic: string;
  parts_of_speech: string[];
  pronunciation_audios: {
    url: string;
    content_type: 'audio/mpeg' | 'audio/ogg' | 'audio/webm"';
    metadata: {
      gender: 'male' | 'female';
      source_id: number;
      pronunciation: string;
      voice_actor_id: number;
      voice_actor_name: string;
      voice_description: string;
    };
  }[];
  readings: {
    reading: string;
    primary: boolean;
    accepted_answer: boolean;
  }[];
};
type WaniKaniSubject = WaniKaniRadical | WaniKaniKanji | WaniKaniVocabulary;
type WaniKaniSubjectTypes = 'kanji' | 'radical' | 'vocabulary';
type WaniKaniStudyMaterial = {
  created: string;
  hidden?: boolean;
  meaning_note: string | null;
  meaning_synonyms: string[];
  reading_note: string | null;
  subject_id: number;
  subject_type: WaniKaniSubjectTypes;
};
type WaniKaniReviewStatistic = {
  created: string;
  subject_id: number;
  subject_type: WaniKaniSubjectTypes;
  meaning_correct: number;
  meaning_incorrect: number;
  meaning_max_streak: number;
  meaning_current_streak: number;
  reading_correct: number;
  reading_incorrect: number;
  reading_max_streak: number;
  reading_current_streak: number;
  percentage_correct: number;
  hidden: number;
};
type WaniKaniAssignment = {
  created: string;
  subject_id: number;
  subject_type: WaniKaniSubjectTypes;
  srs_stage: number;
  unlocked_at: string | null;
  started_at: string | null;
  passed_at: string | null;
  burned_at: string | null;
  available_at: string | null;
  resurrected_at: string | null;
  hidden: boolean;
};
type WaniKaniExport = {
  subjects: WaniKaniObject<WaniKaniSubject>[];
  studyMaterials: WaniKaniObject<WaniKaniStudyMaterial>[];
  reviewStatistics: WaniKaniObject<WaniKaniReviewStatistic>[];
  assignments: WaniKaniObject<WaniKaniAssignment>[];
};
type BunProGrammarPoint = {
  casual_structure: string | null;
  caution: string;
  formal: boolean;
  level: string;
  meaning: string;
  nuance: string;
  part_of_speech_translation: string | null;
  polite_structure: string | null;
  register_translation: string | null;
  structure: string;
  title: string;
  toward_hint: string | null;
  word_type_translation: string | null;
  example_sentences: {
    english: string;
    japanese: string;
    female_audio_url: string | null;
    male_audio_url: string | null;
  }[];
  offline_resources: {
    source: string;
    location: string;
  }[];
  supplemental_links: {
    site: string;
    description: string;
    link: string;
  }[];
  related_grammar_points: {
    id: number;
    title: string;
  }[];
};
type BunProQuestion = {
  alternate_answers: Record<string, string>;
  answer: string;
  audio: string | null;
  english: string;
  japanese: string;
  male_audio_url: string | null;
  nuance: string;
  tense: string | null;
};
type BunProQuestionObject = {
  created_at: string;
  grammar_point_id: number;
  id: number;
  study_question_id: number;
  updated_at: string;
  grammar_point?: BunProGrammarPoint;
  study_question: BunProQuestion;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getAllWK<T>(url: string): Promise<WaniKaniObject<T>[]> {
  const res = await got(url, {
    headers: {
      Authorization: 'Bearer ' + process.env['WK_TOKEN']!,
    },
  }).json<WaniKaniResponse<WaniKaniObject<T>>>();
  if (res.pages.next_url) res.data.push(...(await getAllWK<T>(res.pages.next_url)));
  return res.data;
}

const clearTags = (
  text: string,
  whitelist: string[] = [
    'accent', // Current subject [any]
    'subject', // Link another subject [any](uid=number)
    'example', // example sentence? [any]
    'audio', // Audio [any] (s="link")
    'warning', // Warning text [any]
    'ik', // ImmersionKit query [text]
    'tab', // Tabs always at root [any] title="text"
    'ruby',
    'rt',
    'rp',
    'a',
  ],
) =>
  ([...text.matchAll(/<.+?>/g)].map((el) => [el[0].slice(1, -1).split(' ')[0], el.index!]) as [string, number][])
    .filter(([t]) => whitelist.every((w) => t !== w && t !== `/${w}`))
    .reverse()
    .reduce((acc, [, index]) => acc.slice(0, index) + acc.slice(acc.indexOf('>', index) + 1), text);
const parseFuriganaToRuby = (str: string) =>
  str.replaceAll(
    /([\u4E00-\u9FAF]+?)（([\u3040-\u309F]+?)）/gsu,
    (_, a: string, b: string) => `<ruby>${a}<rp>(</rp><rt>${b}</rt><rp>)</rp></ruby>`,
  );
const cleanupHTML = (str: string) =>
  clearTags(str.replaceAll(/<br>/gs, '\n'))
    .split('\n')
    .map((el) => el.trim())
    .join('\n')
    .replaceAll(/\s{2,}/g, '\n');

async function scrapBunpro() {
  // const bunproHeaders = {
  //   cookie:
  // // spell-checker:disable
  //     '_grammar_app_session=RG1QY21VQXF5cVM3NjMyR1RidEI5dTI4d1JmaXNFZmRzSXdtMEV0aG9XbTNmV3ZuUjB1SGlWcHYzb0p1YW8zU3Fqd1gydGQ4cUd1d04xRGFMbG1CcVlhczFFcWtKTlQ4cGJPQldVTVNEbFRlWkxqRGEvRDdSRHg0b2pkc0pabXlKVk4zVGMvUlZHNXRNRXFVdytZY1pMUGQza01PVTgwdmNLMnJBdXg5TFJ0Y1EyWDJhQnBYNUxpeTllbCtZZlQ2MTEvc2N5VHR0ZTRUMCtnRW5CWlBnR0dVM2RBcmgzVy9KM2ZTa204KzViZz0tLTBNVU01Yks5b1dzQnlvVFFhY1ZPdGc9PQ%3D%3D--b86392e5842df1ea96f6072cfb375876a898d530',
  // // spell-checker:enable
  // };
  // const lessonsPage: string = await got('https://bunpro.jp/lessons', {
  //   headers: bunproHeaders,
  // });
  // await writeFile('./cached/BPLessons.html', lessonsPage);
  const themeId = themesTable.create({
    title: 'BunPro Japanese Grammar',
  }).lastInsertRowid as number;
  const lessonsPage = await readFile('./cached/BPLessons.html', 'utf8');
  const lessonsLevels = [...lessonsPage.matchAll(/N(\d) L(\d+)/g)];
  const lessons = [...lessonsPage.matchAll(/aria-label="(.+?)" href="\/grammar_points\/(\d+)"/g)].map((el, i) => ({
    id: +el[2]!,
    title: el[1]!,
    n: +lessonsLevels[i]![1]!,
    l: +lessonsLevels[i]![2]!,
    i: el.index,
  }));

  const BPids = new Map<number, number>();
  // Generate subjects
  for (const lesson of lessons) {
    const subjectId = subjectsTable.create({
      srsId: 1,
      themeId,
      questionsHaveToAnswer: 1,
      title: lesson.title,
    }).lastInsertRowid as number;
    BPids.set(lesson.id, subjectId);
  }
  // Generate dependencies
  for (const lesson of lessons) {
    const subjectId = BPids.get(lesson.id)!;
    const deps = lessons
      .filter((el) =>
        lesson.l === 1 ? el.n === lesson.n + 1 && el.l === 10 : el.n === lesson.n && el.l === lesson.l - 1,
      )
      .map((el) => BPids.get(el.id)!);
    log('Creating dependencies for', lesson.id, subjectId, 'Deps:', deps.length, 'N', lesson.n, 'L', lesson.l);
    for (const dependencyId of deps)
      subjectDependenciesTable.create({
        percent: 90,
        subjectId,
        dependencyId,
      });
  }
  const parseSubjects = (str: string, lessonId: number) =>
    str
      .replaceAll(/<span class='gp-popout' data-gp-id='(\d+)'>(.+?)<\/span>/gs, (_, id: string, text: string) =>
        Number.parseInt(id) === lessonId
          ? `<accent>${text}</accent>`
          : `<subject uid="${BPids.get(+id)!}">${text}</subject>`,
      )
      .replaceAll(/<strong>(.+?)<\/strong>/gs, (_, t: string) => `<accent>${t}</accent>`)
      .replaceAll(/(<accent>){2,}/gs, '<accent>')
      .replaceAll(/(<\/accent>){2,}/gs, '</accent>');
  // generate questions
  for (const lesson of lessons) {
    // const grammarPage: string = await got('https://bunpro.jp/grammar_points/' + lesson.id, {
    //   headers: bunproHeaders,
    // });
    // await writeFile(`./cached/BPgrammar${lesson.id}.html`, grammarPage);
    // const questions = JSON.parse(
    //   (
    //     (await got('https://bunpro.jp/cram?ids%5B%5D=' + lesson.id, {
    //       headers: {
    //         ...bunproHeaders,
    //         accept: 'application/json, text/javascript, */*; q=0.01',
    //         'x-requested-with': 'XMLHttpRequest',
    //       },
    //     })) as { reviews: string }
    //   ).reviews,
    // ) as BunProQuestionObject[];
    // await writeFile(`./cached/BPgrammar${lesson.id}.json`, JSON.stringify(questions));
    const grammarPage = await readFile(`./cached/BPgrammar${lesson.id}.html`, 'utf8');
    const questions = JSON.parse(
      await readFile(`./cached/BPgrammar${lesson.id}.json`, 'utf8'),
    ) as BunProQuestionObject[];

    const subjectId = BPids.get(lesson.id)!;
    log('Creating questions for', lesson.id, subjectId);
    if (questions.length === 0) {
      log('Deleting cause no questions...');
      subjectsTable.delete(subjectId);
      continue;
    }
    const grammar = questions[0]!.grammar_point!;
    const structure = parseFuriganaToRuby(cleanupHTML(parseSubjects(grammar.structure, lesson.id)));
    const mainDescriptionString = grammarPage.match(/<div class='writeup-body'.+?<script>/s)?.[0];
    const mainDescription = parseFuriganaToRuby(
      cleanupHTML(
        parseSubjects(
          mainDescriptionString
            ? mainDescriptionString
                .replaceAll(
                  /<li class='writeup-example'>.*?<div class='writeup-example--japanese'>(.+?)<div class='writeup-example--english'>(.+?)<\/li>/gs,
                  (_, jp: string, en: string) => clearTags(`<example>${jp}\n${en}</example>`, ['example']),
                )
                .replaceAll(
                  /<div class='caution-header'>(.+?)<\/div>(.+?)<\/div>/gs,
                  (_, header: string, text: string) => `<warning>${header}\n${text}</warning>`,
                )
            : grammar.nuance,
          lesson.id,
        ),
      ),
    );
    const relatedString = grammarPage.match(
      /Synonyms<\/span>.*?grammar-point__container--related-grammar-cards.*?<\/a>.{0,10}?<\/div>/gs,
    )?.[0];
    const related = relatedString
      ? [...relatedString.matchAll(/<a href="\/grammar_points\/(\d+?).*?new">(.+?)<\/.*?<\/a>/gs)]
          .map(([, id, text]) => `<subject uid="${BPids.get(+id!)!}">${text!}</subject>`)
          .join('\n')
      : undefined;
    const antonymsString = grammarPage.match(
      /Antonyms<\/span>.*?grammar-point__container--related-grammar-cards.*?<\/a>.{0,10}?<\/div>/gs,
    )?.[0];
    const antonyms = antonymsString
      ? [...antonymsString.matchAll(/<a href="\/grammar_points\/(\d+?).*?new">(.+?)<\/.*?<\/a>/gs)]
          .map(([, id, text]) => `<subject uid="${BPids.get(+id!)!}">${text!}</subject>`)
          .join('\n')
      : undefined;
    const examples = grammar.example_sentences
      .map(
        (el) =>
          `<example>${parseFuriganaToRuby(
            cleanupHTML(
              parseSubjects(
                `${el.japanese}\n${el.english}${
                  el.female_audio_url ? `\n<audio s="${el.female_audio_url}">Female</audio>` : ''
                }${el.male_audio_url ? `\n<audio s="${el.male_audio_url}">Male</audio>` : ''}`,
                lesson.id,
              ),
            ),
          )}</example>`,
      )
      .join('\n\n');
    const onlineResources = grammar.supplemental_links
      .map((el) => `<a href="${el.link}" target="_blank">${el.site} - ${el.description}</a>`)
      .join('\n');
    const offlineResources = grammar.offline_resources.map((el) => `${el.source} - ${el.location}`).join('\n');
    const wordId = wordsTable.create({
      word:
        '<tab title="Description">' +
        (grammar.part_of_speech_translation ? 'Part of Speech: ' + grammar.part_of_speech_translation + '\n' : '') +
        (grammar.word_type_translation ? 'Word Type: ' + grammar.word_type_translation + '\n' : '') +
        (grammar.register_translation ? 'Register: ' + grammar.register_translation + '\n' : '') +
        (grammar.formal ? 'Formality: Formal\n' : 'Formality: Casual\n') +
        (grammar.level ? `Level: ${grammar.level}\n` : '') +
        '\nStructure: ' +
        structure +
        '\n\nDescription: ' +
        mainDescription +
        '</tab>' +
        (related || antonyms
          ? '<tab title="Related grammar">' +
            (related ? 'Related:\n' + related : '') +
            (antonyms ? (related ? '\n\n' : '') + 'Antonyms:\n' + antonyms : '') +
            '</tab>'
          : '') +
        (onlineResources || offlineResources
          ? '<tab title="Additional resources">' +
            (onlineResources ? 'Online resources:\n' + onlineResources : '') +
            (offlineResources ? (onlineResources ? '\n\n' : '') + 'Books:\n' + offlineResources : '') +
            '</tab>'
          : '') +
        (examples ? '<tab title="Examples">' + examples + '</tab>' : ''),
    }).lastInsertRowid as number;
    for (const q of questions) {
      const questionTitle = parseFuriganaToRuby(
        cleanupHTML(
          parseSubjects(
            q.study_question.japanese +
              '\n' +
              (q.study_question.tense ? q.study_question.tense + ' ' : '') +
              q.study_question.english,
            lesson.id,
          ),
        ),
      );
      const duplicate = questionsTable.getByQuestion(questionTitle);
      if (duplicate) {
        if (!duplicate.answers.includes(q.study_question.answer))
          questionsTable.update(duplicate.id, {
            answers: [...duplicate.answers, q.study_question.answer],
            alternateAnswers: { ...duplicate.alternateAnswers, ...q.study_question.alternate_answers },
          });
      } else
        questionsTable.create({
          answers: [q.study_question.answer],
          question: questionTitle,
          alternateAnswers: q.study_question.alternate_answers,
          descriptionWordId: wordId,
          subjectId,
        });
    }
  }
}
export async function parse() {
  srsTable.create({ title: 'Default', timings: [4, 8, 23, 47, 167, 335, 719, 2879], ok: 5 });
  srsTable.create({ title: 'Fast', timings: [2, 4, 8, 23, 167, 335, 719, 2879], ok: 5 });
  log('Downloading...');

  // const data: WaniKaniExport = {
  //   subjects: await getAllWK('https://api.wanikani.com/v2/subjects'),
  //   studyMaterials: await getAllWK('https://api.wanikani.com/v2/study_materials'),
  //   assignments: await getAllWK('https://api.wanikani.com/v2/assignments'),
  //   reviewStatistics: await getAllWK('https://api.wanikani.com/v2/review_statistics'),
  // };
  // await writeFile('./cached/WK.json', JSON.stringify(data));

  const data = JSON.parse(await readFile('./cached/WK.json', 'utf8')) as WaniKaniExport;
  log('Parsing WaniKani...');
  parseWK(data);
  log('Scrapping BunPro...');
  await scrapBunpro();
  log('Done!');
}
function parseWK(data: WaniKaniExport) {
  const themeId = themesTable.create({
    title: 'WaniKani Japanese',
  }).lastInsertRowid as number;
  const srsId = 2;
  const LVLDeps: { radical: number[]; kanji: number[]; vocabulary: number[] }[] = [];
  const WKids = new Map<number, number>();
  log('Generating subjects...');
  const WKSubjects = data.subjects.filter((s) => !s.data.hidden_at).sort((a, b) => a.data.level - b.data.level);
  const subjectAnswers = new Map<
    number,
    { readings: string[]; meanings: string[]; subject: WaniKaniObject<WaniKaniVocabulary | WaniKaniKanji> }
  >();
  function getRadicalString(WKSubject: WaniKaniRadical) {
    if (WKSubject.characters) return WKSubject.characters;
    const imagesScores = WKSubject.character_images.map((i) => {
      let score = 0;
      if (i.content_type === 'image/svg+xml') score += 100;
      if (i.metadata?.['inline_styles'] === false) score++;
      if (i.metadata?.['dimensions'] === '128x128') score += 10;
      if (i.metadata?.['dimensions'] === '64x64') score += 9;
      if (i.metadata?.['dimensions'] === '32x32') score += 8;
      if (i.metadata?.['dimensions'] === '256x256') score += 7;
      if (i.metadata?.['dimensions'] === '512x512') score += 6;
      if (i.metadata?.['dimensions'] === '1024x1024') score += 5;
      return score;
    });
    const bestImageScoreI = imagesScores.indexOf(imagesScores.sort((a, b) => b - a)[0]!);
    return `<img src="${WKSubject.character_images[bestImageScoreI]!.url}" >`;
  }
  function formatSameSubjects(
    sameSubjects: [
      number,
      {
        readings: string[];
        meanings: string[];
        subject: WaniKaniObject<WaniKaniVocabulary | WaniKaniKanji>;
      },
    ][],
  ) {
    return sameSubjects
      .map(
        ([id, data]) =>
          `<subject uid="${id}">${data.subject.data.characters}</subject> - ${data.readings.join(
            ', ',
          )} - ${data.meanings.join(', ')} `,
      )
      .join('\n');
  }
  function formatComponents(componentIds: number[]) {
    return componentIds
      .map((id) => WKids.get(id)!)
      .map((id) => `<subject uid="${id}">${subjectsTable.get(id)!.title}</subject>`)
      .join('+');
  }
  const putAccentTags = (text: string) =>
    text
      .replaceAll(/(<radical>)|(<kanji>)|(<vocabulary>)/g, '<accent>')
      .replaceAll(/(<\/radical>)|(<\/kanji>)|(<\/vocabulary>)/g, '</accent>');
  for (const WKSubject of WKSubjects) {
    const subjectId = subjectsTable.create({
      srsId,
      themeId,
      title: getRadicalString(WKSubject.data as WaniKaniRadical),
    }).lastInsertRowid as number;
    WKids.set(WKSubject.id, subjectId);
    if (!LVLDeps[WKSubject.data.level - 1])
      LVLDeps[WKSubject.data.level - 1] = {
        kanji: [],
        radical: [],
        vocabulary: [],
      };
    LVLDeps[WKSubject.data.level - 1]![WKSubject.object as WaniKaniSubjectTypes].push(WKSubject.id);
    if (WKSubject.object !== 'radical') {
      subjectAnswers.set(WKSubject.id, {
        meanings: [
          ...WKSubject.data.meanings
            .filter((m) => m.accepted_answer)
            .sort((_, b) => (b.primary ? 1 : 0))
            .map((m) => m.meaning),
          ...WKSubject.data.auxiliary_meanings.filter((m) => m.type === 'whitelist').map((m) => m.meaning),
        ],
        readings: (WKSubject.data as WaniKaniVocabulary).readings
          .filter((m) => m.accepted_answer)
          .sort((_, b) => (b.primary ? 1 : 0))
          .map((m) => m.reading),
        subject: WKSubject as WaniKaniObject<WaniKaniVocabulary | WaniKaniKanji>,
      });
    }
  }
  log('Generating questions and dependencies...');
  for (const WKSubject of WKSubjects) {
    const subjectId = WKids.get(WKSubject.id)!;
    log(subjectId);
    if (WKSubject.data.level > 1)
      for (const dependencyId of LVLDeps[WKSubject.data.level - 2]!.kanji)
        subjectDependenciesTable.create({
          subjectId,
          dependencyId: WKids.get(dependencyId)!,
          percent: 90,
        });
    if (WKSubject.object === 'radical') {
      const radical = WKSubject.data as WaniKaniRadical;
      const wordId = wordsTable.create({
        word: `<tab title="Description">${clearTags(putAccentTags(radical.meaning_mnemonic))}</tab>`,
      }).lastInsertRowid as number;
      const item: TableDTO<Question> = {
        question: `Radical meaning:\n<accent>${getRadicalString(radical)}</accent>`,
        descriptionWordId: wordId,
        answers: [
          ...radical.meanings
            .filter((m) => m.accepted_answer)
            .sort((_, b) => (b.primary ? 1 : 0))
            .map((m) => m.meaning),
          ...radical.auxiliary_meanings.filter((m) => m.type === 'whitelist').map((m) => m.meaning),
        ],
        subjectId,
      };
      questionsTable.create(item);
    } else if (WKSubject.object === 'kanji') {
      const kanji = WKSubject.data as WaniKaniKanji;
      for (const dependencyId of kanji.component_subject_ids)
        subjectDependenciesTable.create({
          subjectId,
          dependencyId: WKids.get(dependencyId)!,
          percent: 100,
        });
      const vAnswers = subjectAnswers.get(WKSubject.id)!;
      const sameComponents = [...subjectAnswers.entries()].filter(
        ([id, answers]) =>
          id !== WKSubject.id &&
          answers.subject.object === 'kanji' &&
          answers.subject.data.component_subject_ids.length === kanji.component_subject_ids.length &&
          kanji.component_subject_ids.every((id) => answers.subject.data.component_subject_ids.includes(id)),
      );
      const vocabVersion = WKSubjects.find((s) => s.object === 'vocabulary' && s.data.characters === kanji.characters);
      const radicals = formatComponents(kanji.component_subject_ids);
      const wordId = wordsTable.create({
        word: clearTags(
          '<tab title="Description">' +
            'Radicals: ' +
            radicals +
            '\n\n' +
            putAccentTags(kanji.meaning_mnemonic) +
            '</tab>' +
            (kanji.meaning_hint ? '<tab title="Hint">' + kanji.meaning_hint + '</tab>' : '') +
            (sameComponents.length > 0
              ? '<tab title="Similar kanji">' + formatSameSubjects(sameComponents) + '</tab>'
              : ''),
        ),
      }).lastInsertRowid as number;
      const wordId2 = wordsTable.create({
        word: clearTags(
          '<tab title="Description">' +
            'Radicals: ' +
            radicals +
            '\n\n' +
            putAccentTags(kanji.reading_mnemonic) +
            '</tab>' +
            (kanji.reading_hint ? '<tab title="Hint">' + kanji.reading_hint + '</tab>' : ''),
        ),
      }).lastInsertRowid as number;
      questionsTable.create({
        question: `Kanji meaning:\n<accent>${kanji.characters}</accent>`,
        answers: vAnswers.meanings,
        descriptionWordId: wordId,
        subjectId,
        ...(vocabVersion
          ? {
              alternateAnswers: Object.fromEntries(
                subjectAnswers
                  .get(vocabVersion.id)!
                  .meanings.filter((m) => !vAnswers.meanings.includes(m))
                  .map((m) => [m, 'Kanji meaning, not vocabulary']),
              ),
            }
          : {}),
      });
      questionsTable.create({
        question: `Kanji reading:\n<accent>${kanji.characters}</accent>`,
        answers: vAnswers.readings,
        descriptionWordId: wordId2,
        subjectId,
        ...(vocabVersion
          ? {
              alternateAnswers: Object.fromEntries(
                subjectAnswers
                  .get(vocabVersion.id)!
                  .readings.filter((m) => !vAnswers.readings.includes(m))
                  .map((m) => [m, 'Kanji reading, not vocabulary']),
              ),
            }
          : {}),
      });
    } else {
      const vocabulary = WKSubject.data as WaniKaniVocabulary;
      for (const dependencyId of vocabulary.component_subject_ids)
        subjectDependenciesTable.create({
          subjectId,
          dependencyId: WKids.get(dependencyId)!,
          percent: 100,
        });
      const vAnswers = subjectAnswers.get(WKSubject.id)!;
      const sameMeaning = [...subjectAnswers.entries()].filter(
        ([id, answers]) =>
          id !== WKSubject.id &&
          answers.subject.object === 'vocabulary' &&
          vAnswers.meanings.some((meaning) => answers.meanings.includes(meaning)),
      );
      const sameReading = [...subjectAnswers.entries()].filter(
        ([id, answers]) =>
          id !== WKSubject.id &&
          answers.subject.object === 'vocabulary' &&
          vAnswers.readings.some((reading) => answers.readings.includes(reading)),
      );
      const sameComponents = [...subjectAnswers.entries()].filter(
        ([id, answers]) =>
          id !== WKSubject.id &&
          answers.subject.object === 'vocabulary' &&
          answers.subject.data.component_subject_ids.length === vocabulary.component_subject_ids.length &&
          vocabulary.component_subject_ids.every((id) => answers.subject.data.component_subject_ids.includes(id)),
      );
      const kanjiVersion = WKSubjects.find((s) => s.object === 'kanji' && s.data.characters === vocabulary.characters);
      const kanji = formatComponents(vocabulary.component_subject_ids);
      const wordId = wordsTable.create({
        word: clearTags(
          '<tab title="Description">Type of word: ' +
            vocabulary.parts_of_speech.join(', ') +
            '\n\nKanji: ' +
            kanji +
            '\n\n' +
            putAccentTags(vocabulary.meaning_mnemonic) +
            '</tab>' +
            (sameMeaning.length > 0 || sameComponents.length > 0
              ? '<tab title="Similar vocabulary">' +
                (sameComponents.length > 0 ? 'Same kanji:\n' + formatSameSubjects(sameComponents) : '') +
                (sameMeaning.length > 0
                  ? (sameComponents.length > 0 ? '\n\n' : '') + 'Same meaning:\n' + formatSameSubjects(sameMeaning)
                  : '') +
                '</tab>'
              : ''),
        ),
      }).lastInsertRowid as number;
      const audioScores = vocabulary.pronunciation_audios.map((a, i) => {
        let score = 0;
        if (a.content_type === 'audio/mpeg') score += i + vocabulary.pronunciation_audios.length * 2;
        else if (a.content_type === 'audio/ogg') score += i + vocabulary.pronunciation_audios.length;
        return score;
      });
      const bestAudio = audioScores
        .sort((a, b) => b - a)
        .map((score) => vocabulary.pronunciation_audios[audioScores.indexOf(score)]!);
      const formatAudio = (a: WaniKaniVocabulary['pronunciation_audios'][0]) =>
        `<audio s="${a.url}">${a.metadata.voice_actor_name}</audio>`;
      const actorIds = [...new Set(bestAudio.map((a) => a.metadata.voice_actor_id))];
      const wordId2 = wordsTable.create({
        word: clearTags(
          '<tab title="Description">' +
            actorIds.map((id) => formatAudio(bestAudio.find((a) => a.metadata.voice_actor_id === id)!)).join('\n') +
            '\n\nType of word: ' +
            vocabulary.parts_of_speech.join(', ') +
            '\n\nKanji: ' +
            kanji +
            '\n\n' +
            putAccentTags(vocabulary.reading_mnemonic) +
            '</tab>' +
            (sameReading.length > 0 || sameComponents.length > 0
              ? '<tab title="Similar vocabulary">' +
                (sameComponents.length > 0 ? 'Same kanji:\n' + formatSameSubjects(sameComponents) : '') +
                (sameReading.length > 0
                  ? (sameComponents.length > 0 ? '\n\n' : '') + 'Same reading:\n' + formatSameSubjects(sameReading)
                  : '') +
                '</tab>'
              : '') +
            '<tab title="Examples">Examples:\n' +
            vocabulary.context_sentences.map((s) => `<example>${s.ja}\n${s.en}</example>`).join('\n') +
            '\n\nAnime sentences:\n<ik>' +
            vocabulary.characters +
            '</ik></tab>',
        ),
      }).lastInsertRowid as number;
      questionsTable.create({
        question: `Vocabulary meaning:\n<accent>${vocabulary.characters}</accent>`,
        answers: vAnswers.meanings,
        descriptionWordId: wordId,
        subjectId,
        ...(kanjiVersion
          ? {
              alternateAnswers: Object.fromEntries(
                subjectAnswers
                  .get(kanjiVersion.id)!
                  .meanings.filter((m) => !vAnswers.meanings.includes(m))
                  .map((m) => [m, 'Vocabulary meaning, not kanji']),
              ),
            }
          : {}),
      });
      questionsTable.create({
        question: `Vocabulary reading:\n<accent>${vocabulary.characters}</accent>`,
        answers: vAnswers.readings,
        descriptionWordId: wordId2,
        subjectId,
        ...(kanjiVersion
          ? {
              alternateAnswers: Object.fromEntries(
                subjectAnswers
                  .get(kanjiVersion.id)!
                  .readings.filter((m) => !vAnswers.readings.includes(m))
                  .map((m) => [m, 'Vocabulary reading, not kanji']),
              ),
            }
          : {}),
      });
    }
  }
  // log('Generating user stats...');
  // for (const WKAssignment of data.assignments) {
  //   if (!WKAssignment.data.started_at) continue;
  //   const subjectId = WKids.get(WKAssignment.data.subject_id)!;
  //   const WKStudyMaterials = data.studyMaterials.find((sm) => sm.data.subject_id === WKAssignment.data.subject_id);
  //   usersSubjectsTable.create({
  //     userId: 1,
  //     subjectId,
  //     nextReview: WKAssignment.data.available_at
  //       ? Math.floor(new Date(WKAssignment.data.available_at).getTime() / 3_600_000)
  //       : undefined,
  //     stage: WKAssignment.data.srs_stage,
  //   });
  //   for (const question of questionsTable.getBySubject(subjectId)) {
  //     const isReading = question.question.includes('reading:\n');
  //     usersQuestionsTable.create({
  //       userId: 1,
  //       questionId: question.id,
  //       note: WKStudyMaterials?.data[isReading ? 'reading_note' : 'meaning_note'] ?? undefined,
  //       synonyms:
  //         WKStudyMaterials && !isReading && WKStudyMaterials.data.meaning_synonyms.length > 0
  //           ? WKStudyMaterials.data.meaning_synonyms
  //           : undefined,
  //     });
  //   }
  // }
  log('Clearing subject dependency duplicates...');
  subjectDependenciesTable.clearDuplicateDependencies();
}
