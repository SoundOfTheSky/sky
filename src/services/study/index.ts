import { usersQuestionsTable } from '@/services/study/users-questions';
import { usersSubjectsTable } from '@/services/study/users-subjects';
import { themesTable } from '@/services/study/themes';
import { usersThemesTable } from '@/services/study/users-themes';
import { srsTable } from '@/services/study/srs';
import { usersAnswersTable } from '@/services/study/users-answers';

export function getThemes(userId?: number) {
  if (userId === undefined) return themesTable.getAll();
  return usersThemesTable.getAllByUser(userId);
}
export function getSubject(subjectId: number, userId: number) {
  return usersSubjectsTable.getSubject(subjectId, userId);
}
export function getQuestion(questionId: number, userId?: number) {
  return usersQuestionsTable.getQuestion(questionId, userId);
}
export function updateQuestionData(
  userId: number,
  questionId: number,
  { note, synonyms }: { note?: string; synonyms?: string[] },
) {
  return usersQuestionsTable.updateByQuestion(userId, questionId, {
    synonyms: synonyms?.map((a) => a.trim()).filter(Boolean),
    note: note?.trim(),
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
export function searchSubjects(themeIds: number[], query?: string, page?: number) {
  return usersSubjectsTable.search(themeIds, query, page);
}
export function getStats(userId: number, start: number, end: number, timezone?: number) {
  return usersAnswersTable.getUserStats(userId, start, end, timezone);
}
