// console.log(DB.prepare(`DELETE FROM ${usersSubjectsTable.name} WHERE stage = 0`).run());
// usersSubjectsTable.unlock(1);
// console.log(usersSubjectsTable.getUserReviewsAndLessons(1)['1'].lessons.length);

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
// console.log('done');

// const questions = questionsTable.getAll();
// for (const question of questions) {
//   const word = wordsTable.get(question.descriptionWordId)!;
//   console.log(question.id);
//   questionsTable.update(question.id, {
//     ...question,
//     description: word.word,
//   });
// }
// console.log('done');
