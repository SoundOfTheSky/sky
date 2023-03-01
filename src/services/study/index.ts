import { usersQuestionsTable } from './users-questions';
import { usersSubjectsTable } from './users-subjects';
import { themesTable } from './themes';
import { usersThemesTable } from './users-themes';
import { srsTable } from './srs';

export { parse as syncWK } from './parse';

export function getThemes(userId?: number) {
  if (userId === undefined) return themesTable.getAll();
  return usersThemesTable.getAllByUser(userId);
}
export function getSubject(subjectId: number, userId: number) {
  return usersSubjectsTable.getReview(subjectId, userId);
}
export function getQuestion(userId: number, questionId: number) {
  return usersQuestionsTable.getUserQuestion(userId, questionId);
}
export function updateQuestionData(
  userId: number,
  questionId: number,
  { note, synonyms }: { note?: string; synonyms?: string[] },
) {
  return usersQuestionsTable.updateByQuestion(userId, questionId, {
    synonyms,
    note,
  });
}
export function answer(subjectId: number, userId: number, correct: boolean) {
  return usersSubjectsTable.answer(subjectId, userId, correct);
}
export function addTheme(userId: number, themeId: number) {
  return usersThemesTable.addToUser(userId, themeId);
}
export function removeTheme(userId: number, themeId: number) {
  return usersThemesTable.removeFromUser(userId, themeId);
}
export function getSRS(id: number) {
  return srsTable.get(id);
}
export function getAllSRS() {
  return srsTable.getAll();
}
export function searchSubjects(themeIds: number[], query: string) {
  return usersSubjectsTable.search(themeIds, query);
}
export function getAllSubjects(themeIds: number[], page: number) {
  return usersSubjectsTable.getAllByThemes(themeIds, page);
}
