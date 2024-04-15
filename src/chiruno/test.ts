// console.log(DB.prepare(`DELETE FROM ${usersSubjectsTable.name} WHERE stage = 0`).run());
// usersSubjectsTable.unlock(1);
// console.log(usersSubjectsTable.getUserReviewsAndLessons(1)['1'].lessons.length);

import { DB } from '@/services/db';
import { questionsTable } from '@/services/study/questions';
import { subjectsTable } from '@/services/study/subjects';
import { cleanupHTML } from '@/utils';

// const db2 = new Database('1706800232495.db', {
//   create: false,
//   readwrite: true,
// });
// const answers = db2.prepare<Record<string, unknown>, []>('SELECT * FROM users_answers').all();
// for (const a of answers)
//   usersAnswersTable.create({
//     id: a.id as number,
//     created: new Date((a.created as string) + 'Z'),
//     correct: a.correct === 1,
//     userId: a.user_id as number,
//     subjectId: a.subject_id as number,
//   });

// const questions = questionsTable.getAll();
// for (const question of questions) {
//   console.log(question.id);
//   const description = cleanupHTML(question.description);
//   const q = cleanupHTML(question.question);
//   if (description !== question.description || q !== question.question)
//     questionsTable.update(question.id, {
//       question: q,
//       description,
//     });
// }

/**
<tab title="Description">Reading: 召し<ruby>上<rt>めしあ</tr></ruby>がります
Meaning: to eat, drink (respectful equivalent of たべます and のみます)</tab>
 */
const subjects = subjectsTable.getAll('theme_id = 2');
for (const subject of subjects) {
  const question = questionsTable.getBySubject(subject.id)[0];
  const word = question.question.replace('日本語: ', '');
  console.log(subject.id, word);
  const wkSubject = DB.prepare<{ id: number }, [string]>('SELECT * FROM subjects WHERE title=?').get(
    'Vocabulary ' + word,
  );
  if (wkSubject) {
    question.description = question.description.replaceAll(
      '</tab>',
      `\nWaniKani link: <subject uid="${wkSubject.id}">${word}</subject></tab>`,
    );
    questionsTable.update(question.id, {
      description: cleanupHTML(question.description.replaceAll('<b>', '<accent>').replaceAll('</b>', '</accent>')),
    });
  }
}
console.log('done');
