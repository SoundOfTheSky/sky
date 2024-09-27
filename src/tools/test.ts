/* eslint-disable unused-imports/no-unused-vars */
import { Database, constants } from 'bun:sqlite';

import TABLES from '@/services/tables';

const DB = new Database('database.db', {
  create: false,
  readwrite: true,
  safeIntegers: false,
  strict: true,
});
DB.fileControl(constants.SQLITE_FCNTL_PERSIST_WAL, 0);
DB.exec('PRAGMA journal_mode = DELETE');
DB.exec('PRAGMA foreign_keys = ON');
DB.exec('PRAGMA auto_vacuum = INCREMENTAL');

console.log(DB.prepare(`SELECT * FROM ${TABLES.STUDY_SUBJECTS} WHERE title LIKE ?`).all('%ン%'));

// /* eslint-disable sonarjs/no-duplicate-string */
// // console.log(DB.prepare(`DELETE FROM users_subjects WHERE stage = 0`).run());
// // usersSubjectsTable.unlock(1);
// // console.log(usersSubjectsTable.getUserReviewsAndLessons(1)['1'].lessons.length);

// import { DB, DBRow } from '@/services/db';
// import { questionsTable } from '@/services/study/questions';
// import { subjectsTable } from '@/services/study/subjects';

// // const db2 = new Database('1706800232495.db', {
// //   create: false,
// //   readwrite: true,
// // });
// // const answers = db2.prepare<Record<string, unknown>, []>('SELECT * FROM users_answers').all();
// // for (const a of answers)
// //   usersAnswersTable.create({
// //     id: a.id as number,
// //     created: new Date((a.created as string) + 'Z'),
// //     correct: a.correct === 1,
// //     userId: a.user_id as number,
// //     subjectId: a.subject_id as number,
// //   });

// // const questions = questionsTable.getAll();
// // for (const question of questions) {
// //   console.log(question.id);
// //   const description = cleanupHTML(question.description);
// //   const q = cleanupHTML(question.question);
// //   if (description !== question.description || q !== question.question)
// //     questionsTable.update(question.id, {
// //       question: q,
// //       description,
// //     });
// // }

// /**
// <tab title="Description">Reading: 召し<ruby>上<rt>めしあ</tr></ruby>がります
// Meaning: to eat, drink (respectful equivalent of たべます and のみます)</tab>
//  */
// const subjects = DB.prepare<DBRow, [number]>(`SELECT * FROM ${TABLES.STUDY_SUBJECTS}`)
//   .all(2)
//   .map((x) => subjectsTable.convertFrom(x)!);
// const ui = {
//   います: 'う',
//   きます: 'く',
//   ぎます: 'ぐ',
//   します: 'す',
//   じます: 'ず',
//   ちます: 'つ',
//   ぢます: 'づ',
//   にます: 'ぬ',
//   ひます: 'ふ',
//   びます: 'ぶ',
//   ぴます: 'ぷ',
//   みます: 'む',
//   ります: 'る',
// };
// for (const subject of subjects) {
//   const question = questionsTable.getBySubject(subject.id)[0];
//   let word = question.question
//     .replace('日本語: ', '')
//     .replaceAll('。', '')
//     .replaceAll(/［.+?］/g, '')
//     .replaceAll(/（.+?）/g, '')
//     .replaceAll('～', '')
//     .replaceAll('　', '')
//     .split(' ')[0];
//   if (word.slice(-3) in ui) word = word.slice(0, -3) + ui[word.slice(-3) as keyof typeof ui];
//   else if (word.slice(-2) === 'ます') word = word.slice(0, -2) + 'る';
//   const wkSubject =
//     DB.prepare<{ id: number }, [string]>('SELECT id FROM ${TABLES.STUDY_SUBJECTS} WHERE title=?').get('Vocabulary ' + word) ||
//     DB.prepare<{ id: number }, [string]>('SELECT id FROM ${TABLES.STUDY_SUBJECTS} WHERE title=?').get('Kana vocabulary  ' + word);
//   const kanjiWK = [
//     ...new Set(
//       question.question
//         .replace('日本語: ', '')
//         .replaceAll(/[^一-龯]/g, '')
//         .split(''),
//     ),
//   ]
//     .map((x) =>
//       DB.prepare<{ id: number; title: string }, [string]>('SELECT id, title FROM ${TABLES.STUDY_SUBJECTS} WHERE title=?').get(
//         'Kanji ' + x,
//       ),
//     )
//     .filter(Boolean);
//   console.log(subject.id, question.question, word, wkSubject?.id, kanjiWK.length);
//   if (wkSubject)
//     question.description = question.description
//       .replaceAll(/\nWaniKani link: .+?<\/tab>/g, '</tab>')
//       .replaceAll('</tab>', `\nWaniKani vacabulary: <subject uid="${wkSubject.id}">${word}</subject></tab>`);
//   if (kanjiWK.length) {
//     question.description = question.description
//       .replaceAll(/\nWaniKani link: .+?<\/tab>/g, '</tab>')
//       .replaceAll(
//         '</tab>',
//         `\nWaniKani kanji: ${kanjiWK.map((x) => `<subject uid="${x!.id}">${x!.title.replace('Kanji ', '')}</subject>`).join('+')}</tab>`,
//       );
//   }
//   questionsTable.update(question.id, {
//     description: cleanupHTML(question.description.replaceAll('<b>', '<accent>').replaceAll('</b>', '</accent>')),
//   });
// }
// console.log('done');
