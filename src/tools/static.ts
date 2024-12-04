/* eslint-disable unused-imports/no-unused-vars */
import { existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import Path from 'node:path'

import { log } from '@softsky/utils'
import { $, CryptoHasher, file } from 'bun'

import { questionsTable } from '@/services/study/questions'
import { subjectsTable } from '@/services/study/subjects'

const STATIC_PATH = Path.join('static', 'static')
function fsArray(path: string): string[] {
  const stat = statSync(path)
  if (stat.isDirectory())
    return readdirSync(path).flatMap(childName =>
      fsArray(Path.join(path, childName)),
    )
  return [path]
}
function findUses(path: string) {
  const subjects = subjectsTable.convertFromMany(
    subjectsTable.query
      .clone()
      .where<{ query: string }>('title LIKE $query')
      .toDBQuery()
      .all({ query: `%${path.slice(7)}%` }),
  )
  const questions = questionsTable.convertFromMany(
    questionsTable.query
      .clone()
      .where<{ query: string }>(
        'question LIKE $query OR description LIKE $query',
      )
      .toDBQuery()
      .all({ query: `%${path.slice(7)}%` }),
  )
  return {
    subjects,
    questions,
  }
}
function deleteUnused() {
  const paths = fsArray(STATIC_PATH)
  for (let index = 0; index < paths.length; index++) {
    const path = paths[index]!
    log(
      `Searching for unused: ${index}/${paths.length} ${Math.floor((index / paths.length) * 100)}% ${path}`,
    )
    const uses = findUses(path)
    if (uses.questions.length === 0 && uses.subjects.length === 0) {
      log('Deleting', path)
      rmSync(path)
    }
  }
}
async function recalcCache() {
  const paths = fsArray(STATIC_PATH)
  for (let index = 0; index < paths.length; index++) {
    const path = paths[index]!
    log(
      `Recalculating cache: ${index}/${paths.length} ${Math.floor((index / paths.length) * 100)}% ${path}`,
    )
    const md5hasher = new CryptoHasher('md5')
    md5hasher.update(await file(path).arrayBuffer())
    const name = md5hasher.digest('hex') + '.' + path.split('.').at(-1)
    const newPath = Path.join(path, '..', name)
    if (path === newPath) continue
    log('Renaming', path, newPath)
    renameSync(path, newPath)
    const uses = findUses(path)
    for (const question of uses.questions)
      questionsTable.update(question.id, {
        question: question.question.replaceAll(path.slice(7), newPath.slice(7)),
        description: question.description.replaceAll(
          path.slice(7),
          newPath.slice(7),
        ),
      })
    for (const subject of uses.subjects)
      subjectsTable.update(subject.id, {
        title: subject.title.replaceAll(path.slice(7), newPath.slice(7)),
      })
  }
}
function findRowsWithUses() {
  const subjects = subjectsTable.convertFromMany(
    subjectsTable.query
      .clone()
      .where<{ query: string }>('title LIKE $query')
      .toDBQuery()
      .all({ query: `%/static/%` }),
  )
  const questions = questionsTable.convertFromMany(
    questionsTable.query
      .clone()
      .where<{
      query: string
    }>('question LIKE $query OR description LIKE $query')
      .toDBQuery()
      .all({ query: `%/static/%` }),
  )
  return {
    subjects,
    questions,
  }
}
function extractUsesFromText(text: string) {
  return [...text.matchAll(/"\/static\/(.+?)"/gs)].map(([, path]) => path!)
}
function findBrokenReferences() {
  log('Searching for uses...')
  const data = findRowsWithUses()
  log('Starting search...')
  for (const text of [
    ...data.subjects.map(s => s.title),
    ...data.questions.map(x => x.question),
    ...data.questions.map(x => x.description),
  ])
    for (const use of extractUsesFromText(text))
      if (!existsSync(Path.join(STATIC_PATH, ...use.split('/'))))
        log('Broken reference', use)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function image(name: string) {
  return $`magick "${name}" -resize "4096x4096>" "${name.slice(0, name.lastIndexOf('.'))}.webp"`
}

// async function convert() {
//   const paths = fsArray(STATIC_PATH);
//   for (let i = 0; i < paths.length; i++) {
//     const path = paths[i];
//     if (['.jpg', '.jpeg', '.jpe', '.png', '.gif', '.bmp', '.heic'].some((x) => path.endsWith(x))) {
//       await image(path);
//       const uses = findUses(path);
//     for (const question of uses.questions)
//       questionsTable.update(question.id, {
//         question: question.question.replaceAll(path.slice(7), newPath.slice(7)),
//         description: question.description.replaceAll(path.slice(7), newPath.slice(7)),
//       });
//     for (const subject of uses.subjects)
//       subjectsTable.update(subject.id, {
//         title: subject.title.replaceAll(path.slice(7), newPath.slice(7)),
//       });
//     }
//   }
// }

setTimeout(async () => {
  deleteUnused()
  await recalcCache()
  findBrokenReferences()
  log('Done!')
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit()
}, 3000)
