// import { DB } from '@/services/db/db';
// import { questionsTable } from '@/services/study/questions';
// import { log } from 'sky-utils';

// for (const { id } of DB.prepare<{ id: number }, []>(
//   `SELECT q.id FROM study_questions q
// JOIN study_subjects s ON s.id = q.subject_id
// WHERE s.theme_id = 5`,
// ).all()) {
//   log(id);
//   questionsTable.update(id, {
//     choose: null,
//   });
// }
// log('done!');
