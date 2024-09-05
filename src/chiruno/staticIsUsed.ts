/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { CryptoHasher, file } from 'bun';
import { readdirSync, statSync, rmSync, renameSync, existsSync } from 'fs';
import { join } from 'node:path';

import { DB } from '@/services/db';
import { questionsTable } from '@/services/study/questions';
import { subjectsTable } from '@/services/study/subjects';
import TABLES from '@/services/tables';
import { DBRow } from '@/sky-shared/db';
import { log } from '@/sky-utils';

const STATIC_PATH = join('static', 'static');
function fsArray(path: string): string[] {
  const stat = statSync(path);
  if (stat.isDirectory()) return readdirSync(path).flatMap((childName) => fsArray(join(path, childName)));
  return [path];
}
function findUses(path: string) {
  const subjects = DB.prepare<DBRow, [string]>(`SELECT * FROM ${TABLES.STUDY_SUBJECTS} WHERE title LIKE ?`)
    .all(`%${path.slice(7)}%`)
    .map((x) => subjectsTable.convertFrom(x)!);
  const questions = DB.prepare<DBRow, [string, string]>(
    `SELECT * FROM ${TABLES.STUDY_QUESTIONS} WHERE question LIKE ? OR description LIKE ?`,
  )
    .all(`%${path.slice(7)}%`, `%${path.slice(7)}%`)
    .map((x) => questionsTable.convertFrom(x)!);
  return {
    subjects,
    questions,
  };
}
function deleteUnused() {
  const paths = fsArray(STATIC_PATH);
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    log(`Searching for unused: ${i}/${paths.length} ${Math.floor((i / paths.length) * 100)}% ${path}`);
    const uses = findUses(path);
    if (uses.questions.length === 0 && uses.subjects.length === 0) {
      log('Deleting', path);
      rmSync(path);
    }
  }
}
async function recalcCache() {
  const paths = fsArray(STATIC_PATH);
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    log(`Recalculating cache: ${i}/${paths.length} ${Math.floor((i / paths.length) * 100)}% ${path}`);
    const md5hasher = new CryptoHasher('md5');
    md5hasher.update(await file(path).arrayBuffer());
    const name = md5hasher.digest('hex') + '.' + path.split('.').at(-1);
    const newPath = join(path, '..', name);
    if (path === newPath) continue;
    log('Renaming', path, newPath);
    renameSync(path, newPath);
    const uses = findUses(path);
    for (const question of uses.questions)
      questionsTable.update(question.id, {
        question: question.question.replaceAll(path.slice(7), newPath.slice(7)),
        description: question.description.replaceAll(path.slice(7), newPath.slice(7)),
      });
    for (const subject of uses.subjects)
      subjectsTable.update(subject.id, {
        title: subject.title.replaceAll(path.slice(7), newPath.slice(7)),
      });
  }
}
function findRowsWithUses() {
  const subjects = DB.prepare<DBRow, []>(`SELECT * FROM ${TABLES.STUDY_SUBJECTS} WHERE title LIKE "%/static/%"`)
    .all()
    .map((x) => subjectsTable.convertFrom(x)!);
  const questions = DB.prepare<DBRow, []>(
    `SELECT * FROM ${TABLES.STUDY_QUESTIONS} WHERE question LIKE "%/static/%" OR description LIKE "%/static/%"`,
  )
    .all()
    .map((x) => questionsTable.convertFrom(x)!);
  return {
    subjects,
    questions,
  };
}
function extractUsesFromText(text: string) {
  return [...text.matchAll(/"\/static\/(.+?)"/gs)].map(([_, path]) => path);
}
function findBrokenReferences() {
  log('Searching for uses...');
  const data = findRowsWithUses();
  log('Starting search...');
  for (const text of [
    ...data.subjects.map((s) => s.title),
    ...data.questions.map((x) => x.question),
    ...data.questions.map((x) => x.description),
  ])
    for (const use of extractUsesFromText(text))
      if (!existsSync(join(STATIC_PATH, ...use.split('/')))) log('Broken reference', use);
}

// eslint-disable-next-line @typescript-eslint/require-await
setTimeout(async () => {
  deleteUnused();
  await recalcCache();
  findBrokenReferences();
  log('Done!');
  process.exit();
}, 3000);
