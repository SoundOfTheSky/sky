/* eslint-disable unicorn/consistent-function-scoping */
/* eslint-disable unused-imports/no-unused-vars */

import { cpSync, readdirSync, readFileSync } from 'node:fs'
import Path from 'node:path'

import { log } from '@softsky/utils'
import { CryptoHasher, file, write } from 'bun'

import { DBRow, UpdateTableDTO } from '@/services/db/types'
import { questionsTable } from '@/services/study/questions'
import { subjectDependenciesTable } from '@/services/study/subject-dependencies'
import { subjectsTable } from '@/services/study/subjects'
import TABLES from '@/services/tables'
import { TableDefaults } from '@/sky-shared/database'
import { StudyQuestionDTO, StudySubjectDTO } from '@/sky-shared/study'

import { DB } from 'services/db/database'

type WKResponse<T> = {
  object: string
  url: string
  pages: {
    per_page: number
    next_url?: string
    previous_url?: string
  }
  total_count: number
  data_updated_at: string
  data: WKObject<T>[]
}
type WKObject<T> = {
  id: number
  object: string
  url: string
  data_updated_at: string
  data: T
}
type WKSubject = {
  auxiliary_meanings: {
    meaning: string
    type: 'whitelist' | 'blacklist'
  }[]
  created_at: string
  document_url: string
  hidden_at?: string
  lesson_position: number
  level: number
  meaning_mnemonic: string
  meanings: {
    meaning: string
    primary: boolean
    accepted_answer: boolean
  }[]
  slug: string
  spaced_repetition_system_id: number
}
type WKRadical = WKSubject & {
  amalgamation_subject_ids: number[]
  characters?: string
  character_images: {
    url: string
    content_type: 'image/png' | 'image/svg+xml'
    metadata: unknown
    inline_styles?: boolean
    color?: string
    dimensions?: string
    style_name?: string
  }[]
}
type WKKanji = WKSubject & {
  characters: string
  amalgamation_subject_ids: number[]
  component_subject_ids: number[]
  meaning_hint?: string
  reading_hint?: string
  reading_mnemonic: string
  readings: {
    reading: string
    primary: boolean
    accepted_answer: boolean
    type: 'kunyomi' | 'nanori' | 'onyomi'
  }[]
  visually_similar_subject_ids: number[]
}
type WKKana = WKSubject & {
  characters: string
  context_sentences: {
    en: string
    ja: string
  }[]
  meaning_mnemonic: string
  parts_of_speech: string[]
  pronunciation_audios: {
    url: string
    content_type: 'audio/mpeg' | 'audio/ogg'
    metadata: {
      gender: string
      source_id: number
      pronunciation: string
      voice_actor_id: number
      voice_actor_name: string
      voice_description: string
    }
  }[]
}
type WKVocab = WKKana & {
  characters: string
  component_subject_ids: number[]
  readings: {
    reading: string
    primary: boolean
    accepted_answer: boolean
  }[]
  reading_mnemonic: string
}
type WKAnySubject = WKRadical | WKKanji | WKKana | WKVocab

// === Main logic ===
/** Format HTML to simple string */
function cleanupHTML(
  text: string,
  whitelist: string[] = [
    'accent', // Current subject [any]
    'subject', // Link another subject [any](uid=number)
    'example', // example sentence? [any]
    'audio', // Audio [any] (s="link")
    'warning', // Warning text [any]
    'ik', // ImmersionKit query [text]
    'tab', // Tabs always at root [any] title="text"
    'jp-pitch-accent', // Pitch accent
    'jp-conjugation',
    'img',
    'ruby',
    'rt',
    'rp',
    'a',
    'b',
    'i',
  ],
) {
  text = text
    .replaceAll('<br>', '\n') // br to \n
    .split('\n')
    .map(element => element.trim()) // trim every line
    .join('\n')
    .replaceAll(/\n{3,}/gs, '\n\n') // no more than two new lines
    .replaceAll(/(\s+)<\/tab>/gs, '</tab>') // spaces before tab
    .replaceAll(/<tab title="(.+)">(\s+)/gs, (_, x) => `<tab title="${x}">`) // spaces after tab
    .replaceAll(/<(\S+)(>|\s[^>]*>)\s*<\/\1>/g, '') // empty tags
    .trim() // final trim

  return [...text.matchAll(/<.+?>/g)]
    .map(element => [element[0].slice(1, -1).split(' ')[0], element.index] as const)
    .filter(([t]) => whitelist.every(w => t !== w && t !== `/${w}`))
    .reverse()
    .reduce(
      (accumulator, [, index]) =>
        accumulator.slice(0, index) + accumulator.slice(accumulator.indexOf('>', index) + 1),
      text,
    )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function downloadWK() {
  const subjects: WKObject<WKAnySubject>[] = []
  let nextUrl: string | undefined = 'https://api.wanikani.com/v2/subjects'
  while (nextUrl) {
    log(nextUrl)
    const json = (await fetch(nextUrl, {
      headers: {
        Authorization: 'Bearer ' + process.env.WK,
      },
    }).then(x => x.json())) as WKResponse<WKAnySubject>
    nextUrl = json.pages.next_url
    subjects.push(...json.data)
  }
  return subjects
}

async function parseWK() {
  // === Loading and basic caching ===
  const subjects = (
    JSON.parse(
      readFileSync(Path.join('assets', 'WK.json'), 'utf8'),
    ) as WKObject<WKAnySubject>[]
  )
    .filter(x => !x.data.hidden_at)
    .toSorted(
      (a, b) =>
        a.data.level * 100
        + a.data.lesson_position
        - (b.data.level * 100 + b.data.lesson_position),
    )
  const subjectsMap = new Map<number, WKObject<WKAnySubject>>()
  const levelDeps: number[][] = Array.from({ length: 60 })
    .fill(0)
    .map(() => [])
  for (const subject of subjects) {
    levelDeps[subject.data.level - 1]!.push(subject.id)
    subjectsMap.set(subject.id, subject)
  }
  const kanjiWithStrokeOrder = new Set(
    readdirSync(Path.join('assets', 'stroke_order')).map(element => +element.slice(0, -4)),
  )
  const pitchAccents = readFileSync(Path.join('assets', 'accents.txt'), 'utf8')
    .split('\n')
    // eslint-disable-next-line @stylistic/no-tabs
    .map(l => l.split('	') as [string, string, string])
  const fileCache = new Map<string, string>(
    readFileSync(Path.join('assets', 'WKfiles.txt'), 'utf8')
      .split('\n')
      .map(l => l.split(' ') as [string, string]),
  )
  const filesSink = file(Path.join('assets', 'WKfiles.txt')).writer()
  async function downloadFileAndGetHash(url: string, extension: string) {
    if (fileCache.has(url)) return fileCache.get(url)!
    const blob = await fetch(url).then(x => x.blob())
    const md5hasher = new CryptoHasher('md5')
    md5hasher.update(await blob.arrayBuffer())
    const name = md5hasher.digest('hex') + '.' + extension
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    await write(Path.join('assets', 'wanikani', name), blob as any)
    filesSink.write(`\n${url} ${name}`)
    fileCache.set(url, name)
    return name
  }

  // === Generating logic ===
  const subjectTag = async (subject: WKObject<WKAnySubject>, text?: string) =>
    `<subject uid="${subject.id}" title="${subject.object[0]!.toUpperCase() + subject.object.slice(1)}: ${
      subject.data.characters ?? subject.data.slug
    }">${
      text
      ?? subject.data.characters
      ?? ('character_images' in subject.data
        ? `<img class="em" src="/static/${await downloadFileAndGetHash(
          subject.data.character_images.find(
            x => x.content_type === 'image/svg+xml',
          )!.url,
          'svg',
        )}">`
        : subject.data.slug)
    }</subject>`
  async function generateRelated(subject: WKObject<WKAnySubject>) {
    let txt = await subjectTag(subject)
    if (subject.object === 'kanji' || subject.object === 'vocabulary')
      txt += ` - ${getSubjectReadings(subject as WKObject<WKKanji | WKVocab>).join(', ')}`
    txt += ` - ${getSubjectMeanings(subject).join(', ')}`
    if (subject.object === 'kanji' || subject.object === 'vocabulary')
      txt += ` [${(
        await Promise.all(
          (
            subject as WKObject<WKKanji | WKVocab>
          ).data.component_subject_ids.map(id =>
            subjectTag(subjectsMap.get(id)!),
          ),
        ).then(x => x.join('\n'),
        ))}]`
    return txt
  }
  const getSubjectMeanings = (s: WKObject<WKAnySubject>) => [
    ...s.data.meanings.filter(x => x.accepted_answer).map(x => x.meaning),
    ...s.data.auxiliary_meanings
      .filter(x => x.type === 'whitelist')
      .map(x => x.meaning),
  ]
  const getSubjectReadings = (s: WKObject<WKKanji | WKVocab>) =>
    s.data.readings.filter(x => x.accepted_answer).map(x => x.reading)
  const parseWKDescription = (string_: string) =>
    string_
      .replaceAll('<radical>', '<accent>')
      .replaceAll('</radical>', '</accent>')
      .replaceAll('<kanji>', '<accent>')
      .replaceAll('</kanji>', '</accent>')
      .replaceAll('<vocabulary>', '<accent>')
      .replaceAll('</vocabulary>', '</accent>')
      .replaceAll('<reading>', '<accent>')
      .replaceAll('</reading>', '</accent>')
      .replaceAll('<meaning>', '<accent>')
      .replaceAll('</meaning>', '</accent>')

  // === Schemas ===
  const schemas: Record<
    string,
    (s: WKObject<WKAnySubject>) => string | Promise<string>
  > = {
    radical: () => `<tab title="Description">{{level}}
    
{{meaningDesc}}</tab><tab title="Related">{{sameMeaning}}
  
{{usedIn}}</tab>`,
    kanjiMeaning: () => `<tab title="Description">{{level}}
{{deps}}
{{strokeOrder}}

{{meaningDesc}}</tab><tab title="Related">{{similar}}

{{sameMeaning}}

{{usedIn}}</tab>`,
    kanjiReading: () => `<tab title="Description">{{deps}}

{{readingDesc}}</tab><tab title="Related">{{sameReading}}</tab>`,
    vocabularyMeaning: () => `<tab title="Description">{{level}}
{{deps}}
{{typeOfWord}}

{{meaningDesc}}</tab><tab title="Related">{{similar}}

{{sameMeaning}}</tab>`,
    vocabularyReading: () => `<tab title="Description">{{deps}}
{{pitchAccent}}
{{audio}}
{{conjugation}}

{{readingDesc}}</tab><tab title="Examples">{{examples}}
Anime sentences:
<ik>{{title}}</ik></tab><tab title="Related">{{sameReading}}</tab>`,
    kana: () => `<tab title="Description">{{level}}
{{typeOfWord}}
{{pitchAccent}}
{{audio}}
{{conjugation}}

{{meaningDesc}}</tab><tab title="Examples">{{examples}}
Anime sentences:
<ik>{{title}}</ik></tab><tab title="Related">{{sameMeaning}}</tab>`,
    meaningDesc: s =>
      parseWKDescription(
        s.data.meaning_mnemonic
        + ('meaning_hint' in s.data && s.data.meaning_hint
          ? '\n\n' + s.data.meaning_hint
          : ''),
      ),
    readingDesc: s =>
      parseWKDescription(
        (s.data as WKKanji).reading_mnemonic
        + ('reading_hint' in s.data && s.data.reading_hint
          ? '\n\n' + s.data.reading_hint
          : ''),
      ),
    deps: async s =>
      (s.data as WKKanji).component_subject_ids.length > 0
        ? `${s.object === 'kanji' ? 'Radicals' : 'Kanji'}: ${(
          await Promise.all(
            (s.data as WKKanji).component_subject_ids.map(id =>
              subjectTag(subjectsMap.get(id)!),
            ),
          ).then(x => x.join('\n'),
          ))}`
        : ``,
    similar: async (s) => {
      const sub = s as WKObject<WKKanji>
      if (sub.data.component_subject_ids.length === 0) return ''
      const similar = subjects.filter(
        subject =>
          subject.id !== sub.id
          && subject.object === sub.object
          && (('visually_similar_subject_ids' in sub.data
            && sub.data.visually_similar_subject_ids.includes(subject.id))
          || ((subject.data as WKKanji).component_subject_ids.length
            === sub.data.component_subject_ids.length
            && sub.data.component_subject_ids.every(d =>
              (subject.data as WKKanji).component_subject_ids.includes(d),
            ))),
      )
      return similar.length > 0
        ? `<b>Similar:</b>\n${(await Promise.all(similar.map(x => generateRelated(x))).then(x => x.join('\n')))}`
        : ``
    },
    sameMeaning: async (s) => {
      const answers = getSubjectMeanings(s)
      const same = subjects.filter(
        subject =>
          subject.id !== s.id
          && subject.object === s.object
          && answers.some(a => getSubjectMeanings(subject).includes(a)),
      )
      return same.length > 0
        ? `<b>Same meaning:</b>\n${(await Promise.all(same.map(x => generateRelated(x))).then(x => x.join('\n')))}`
        : ``
    },
    sameReading: async (s) => {
      const answers = getSubjectReadings(s as WKObject<WKKanji>)
      const same = subjects.filter(
        subject =>
          subject.id !== s.id
          && subject.object === s.object
          && answers.some(a =>
            getSubjectReadings(subject as WKObject<WKKanji>).includes(a),
          ),
      )
      return same.length > 0
        ? `<b>Same reading:</b>\n${(await Promise.all(same.map(x => generateRelated(x))).then(x => x.join('\n')))}`
        : ``
    },
    usedIn: async s =>
      (s.data as WKRadical).amalgamation_subject_ids.length > 0
        ? `<b>Used in:</b>\n${(
          await Promise.all(
            (s.data as WKRadical).amalgamation_subject_ids
              .map(id => subjectsMap.get(id)!)
              .map(x => generateRelated(x)),
          ).then(x => x.join('\n'))
        )}`
        : '',
    audio: async (s) => {
      const audios = (s.data as WKVocab).pronunciation_audios.filter(
        x => x.content_type === 'audio/mpeg',
      )
      const urls = await Promise.all(
        audios.map(a => downloadFileAndGetHash(a.url, 'mp3')),
      )
      return audios
        .map(
          (a, index) =>
            `<audio s="/static/${urls[index]}">${a.metadata.pronunciation} (${a.metadata.voice_actor_name})</audio>`,
        )
        .join('\n')
    },
    examples: s =>
      (s.data as WKVocab).context_sentences
        .map(({ ja, en }) => `<example>${ja}\n${en}</example>`)
        .join('\n'),
    strokeOrder: (s) => {
      if (!s.data.characters) return ''
      const code = s.data.characters.codePointAt(0)!
      return kanjiWithStrokeOrder.has(code)
        ? `<img class="stroke-order" src="/static/stroke_order/${code}.svg">`
        : ''
    },
    typeOfWord: s =>
      `Type of word: ${(s.data as WKVocab).parts_of_speech.join(', ')}`,
    pitchAccent: (s) => {
      const p
        = s.object === 'kana_vocabulary'
          ? pitchAccents.filter(
            p => s.data.characters === p[0] || s.data.characters === p[1],
          )
          : pitchAccents.filter((p) => {
            const readings = getSubjectReadings(s as WKObject<WKVocab>)
            return (
              (s.data.characters === p[0] || s.data.characters === p[1])
              && (p[1].length === 0
                || readings.includes(p[0])
                || readings.includes(p[1]))
            )
          })
      return p.length > 0
        ? `Pitch accents: ${p
          .map(
            x =>
              `<jp-pitch-accent h="${x[1]}" p="${x[2]}">${s.data.characters}</jp-pitch-accent>`,
          )
          .join(', ')}`
        : ''
    },
    conjugation: s =>
      `<jp-conjugation>${s.data.characters ?? ''}</jp-conjugation>`,
    title: s => s.data.characters ?? '',
    level: s => `Level: ` + s.data.level,
  }
  async function parseSchema(
    schemaName: string,
    subject: WKObject<WKAnySubject>,
  ): Promise<string> {
    const schema = schemas[schemaName]!
    let text = await schema(subject)
    for (const [a, b] of text.matchAll(/{{(.+?)}}/gs))
      text = text.replace(a, await parseSchema(b!, subject))
    return text
  }
  // CHANGE THIS IF YOU ARE NOT CREATING
  // themesTable.create({
  //   title: 'JP WaniKani',
  // });
  // const themeId = lastInsertRowIdQuery.get()!.id;
  const themeId = 4
  const dbsubjects = DB.prepare<TableDefaults, [number]>(
    `SELECT * FROM ${TABLES.STUDY_SUBJECTS} WHERE theme_id = ?`,
  )
    .all(themeId)
    .map(x => x.id)
  // END OF CHANGE BLOCK
  log('Deleting dependencies')
  DB.prepare(
    `DELETE FROM ${TABLES.STUDY_SUBJECT_DEPS}
    WHERE subject_id IN (
      SELECT id FROM ${TABLES.STUDY_SUBJECTS} WHERE theme_id = ?
    )`,
  ).run(themeId)
  const databaseMap = new Map<number, number>()
  const idReplaces = new Map<number, number>([])
  for (const subject of subjects) {
    log(
      `Subject ${subject.id} ${subject.object} ${subject.data.characters ?? subject.data.slug}`,
    )
    const s: StudySubjectDTO = {
      themeId,
      title: '',
    }
    const qs: UpdateTableDTO<StudyQuestionDTO>[] = []
    const sameTitle = subjects.filter(
      s =>
        s.data.characters === subject.data.characters && s.id !== subject.id,
    )
    const meanings = getSubjectMeanings(subject)
    const alternateMeanings = sameTitle
      .flatMap(x => getSubjectMeanings(x))
      .map(x => x.toLowerCase())
      .filter(a => meanings.every(x => x.toLowerCase() !== a))
    switch (subject.object) {
      case 'vocabulary': {
        const vocabulary = subject as WKObject<WKVocab>
        s.title = `Vocabulary:\n${vocabulary.data.characters}`
        const readings = getSubjectReadings(vocabulary)
        const alternateReadings = sameTitle
          .filter(s => s.object === 'vocabulary' || s.object === 'kanji')
          .flatMap(s => getSubjectReadings(s as WKObject<WKVocab>))
          .map(x => x.toLowerCase())
          .filter(a => readings.every(x => x.toLowerCase() !== a))
        qs.push({
          answers: meanings,
          description: await parseSchema('vocabularyMeaning', vocabulary),
          question: `Vocabulary meaning:\n<accent>${s.title.slice(12)}</accent>`,
          subjectId: -1,
          alternateAnswers:
            alternateMeanings.length === 0
              ? null
              : Object.fromEntries(
                alternateMeanings.map(a => [
                  a,
                  `Please type vocabulary meaning`,
                ]),
              ),
        }, {
          answers: readings,
          description: await parseSchema('vocabularyReading', vocabulary),
          question: `Vocabulary reading:\n<accent>${s.title.slice(12)}</accent>`,
          subjectId: -1,
          alternateAnswers:
            alternateReadings.length === 0
              ? null
              : Object.fromEntries(
                alternateReadings.map(a => [
                  a,
                  `Please type vocabulary reading`,
                ]),
              ),
        })
        break
      }
      case 'kana_vocabulary': {
        const kana = subject as WKObject<WKKana>
        s.title = `Kana vocabulary:\n${kana.data.characters}`
        qs.push({
          answers: meanings,
          description: await parseSchema('kana', kana),
          question: `Kana vocabulary meaning:\n<accent>${s.title.slice(17)}</accent>`,
          subjectId: -1,
          alternateAnswers:
            alternateMeanings.length === 0
              ? null
              : Object.fromEntries(
                alternateMeanings.map(a => [
                  a,
                  `Please type vocabulary meaning`,
                ]),
              ),
        })
        break
      }
      case 'kanji': {
        const kanji = subject as WKObject<WKKanji>
        s.title = `Kanji:\n${kanji.data.characters}`
        const readings2 = getSubjectReadings(kanji)
        const alternateReadings2 = sameTitle
          .filter(s => s.object === 'vocabulary' || s.object === 'kanji')
          .flatMap(s => getSubjectReadings(s as WKObject<WKVocab>))
          .map(x => x.toLowerCase())
          .filter(a => readings2.every(x => x.toLowerCase() !== a))
        qs.push({
          answers: meanings,
          description: await parseSchema('kanjiMeaning', kanji),
          question: `Kanji meaning:\n<accent>${s.title.slice(7)}</accent>`,
          subjectId: -1,
          alternateAnswers:
            alternateMeanings.length === 0
              ? null
              : Object.fromEntries(
                alternateMeanings.map(a => [
                  a,
                  `Please type kanji meaning`,
                ]),
              ),
        }, {
          answers: readings2,
          description: await parseSchema('kanjiReading', kanji),
          question: `Kanji reading:\n<accent>${s.title.slice(7)}</accent>`,
          subjectId: -1,
          alternateAnswers:
            alternateReadings2.length === 0
              ? null
              : Object.fromEntries(
                alternateReadings2.map(a => [
                  a,
                  `Please type kanji reading`,
                ]),
              ),
        })
        break
      }
      case 'radical': {
        const radical = subject as WKObject<WKRadical>
        s.title = radical.data.characters
          ? `Radical:\n${radical.data.characters}`
          : `Radical:\n<img class="em" src="/static/${await downloadFileAndGetHash(
            radical.data.character_images.find(
              x => x.content_type === 'image/svg+xml',
            )!.url,
            'svg',
          )}">`
        qs.push({
          answers: meanings,
          description: await parseSchema('radical', radical),
          question: `Radical meaning:\n<accent>${s.title.slice(9)}</accent>`,
          subjectId: -1,
          alternateAnswers:
            alternateMeanings.length === 0
              ? null
              : Object.fromEntries(
                alternateMeanings.map(a => [
                  a,
                  `Please type radical meaning`,
                ]),
              ),
        })
        break
      }
    }

    // === DB ===
    let id
      = idReplaces.get(subject.id)
      ?? DB.prepare<{ id: number }, [string]>(
        `SELECT id FROM ${TABLES.STUDY_SUBJECTS} WHERE title = ?`,
      ).get(s.title)?.id
      ?? DB.prepare<{ id: number }, [string]>(
        `SELECT id FROM ${TABLES.STUDY_SUBJECTS} WHERE title = ?`,
      ).get(s.title.replaceAll(':\n', ' '))?.id
    if (!id && s.title.includes(' お'))
      id = DB.prepare<{ id: number }, [string]>(
        `SELECT id FROM ${TABLES.STUDY_SUBJECTS} WHERE title = ?`,
      ).get(s.title.replace(' お', ' '))?.id
    // === find subject by answers ===
    if (!id) {
      const q = questionsTable.convertFrom(
        DB.prepare<DBRow, [string, string]>(
          `SELECT * FROM study_questions WHERE answers = ? AND question LIKE ?`,
        ).get(
          getSubjectMeanings(subject).join('|'),
          `${qs[0]!.question!.slice(0, 4)}%`,
        ),
      )
      if (q) {
        console.log('FOUND HARD WAY')
        id = q.subjectId
      }
    }
    if (id) {
      // log(`[UPDATING SUBJECT] ${subject.id} ${s.title}`);
      subjectsTable.update(id, s)
      dbsubjects.splice(dbsubjects.indexOf(id), 1)
    }
    else {
      throw new Error('It must exist')
      // log(`[CREATING SUBJECT] ${subject.id} ${s.title}`);
      // subjectsTable.create(s);
      // id = lastInsertRowIdQuery.get()!.id;
    }
    databaseMap.set(subject.id, id)
    const dbqs = subjectsTable.getById(id)!.questionIds
    if (dbqs.length !== qs.length) throw new Error('DBQS is not equal')
    for (let index = 0; index < qs.length; index++) {
      const q = qs[index]!
      const dbq = dbqs[index]
      q.subjectId = id
      if (dbq) {
        // log(`[UPDATING QUESTION] ${i ? 'Meaning' : 'Reading'}`);
        questionsTable.update(dbq, q)
      }
      else {
        throw new Error('It must exist')
        // log(`[CREATING QUESTION] ${i ? 'Meaning' : 'Reading'}`);
        // questionsTable.create(q as QuestionDTO);
      }
    }
  }
  // === Replace subject ids ===
  log('Fixing stuff in descriptions...')
  const questions = questionsTable.convertFromMany(
    questionsTable.query
      .clone()
      .join(
        `${TABLES.STUDY_SUBJECTS} s`,
        `s.id = ${TABLES.STUDY_QUESTIONS}.subject_id`,
      )
      .where<{ themeId: number }>('s.theme_id = $themeId')
      .toDBQuery()
      .all({ themeId }),
  )
  for (const question of questions) {
    log(question.id)
    questionsTable.update(question.id, {
      question: cleanupHTML(question.question),
      description: cleanupHTML(
        question.description
          // Subject ids only known after all updates so we fix them now
          .replaceAll(
            /<subject uid="(\d+?)"/g,
            (_, id) => `<subject uid="${databaseMap.get(Number.parseInt(id as string))}"`,
          ),
      ),
    })
  }

  // === Dependenices ===
  log('Creating deps...')
  for (const subject of subjects) {
    const id = databaseMap.get(subject.id)!
    if (subject.data.level > 1)
      for (const dep of levelDeps[subject.data.level - 2]!)
        subjectDependenciesTable.create({
          dependencyId: databaseMap.get(dep)!,
          percent: 90,
          subjectId: id,
        })
    if ('component_subject_ids' in subject.data)
      for (const dep of subject.data.component_subject_ids)
        subjectDependenciesTable.create({
          dependencyId: databaseMap.get(dep)!,
          percent: 100,
          subjectId: id,
        })
  }
  log(`Unused subjects: ${dbsubjects.length} ${dbsubjects.join(', ')}`)
  await filesSink.end()
  cpSync(Path.join('assets', 'wanikani'), Path.join('static', 'static'), {
    recursive: true,
  })
  cpSync(
    Path.join('assets', 'stroke_order'),
    Path.join('static', 'static', 'stroke_order'),
    {
      recursive: true,
    },
  )
}

setTimeout(async () => {
  log('Generating...')
  // await write(join('assets', 'WK.json'), JSON.stringify(await downloadWK(), undefined, 2));
  await parseWK()
  log('Done...')
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit()
}, 3000)
