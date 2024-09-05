import { createRestEndpointHandler, RESTApiUser } from '@/services/http/rest';
import { usersQuestionsTable } from '@/services/study/users-questions';
import { StudyUserQuestion, StudyUserQuestionT } from '@/sky-shared/study';

export default createRestEndpointHandler(
  new RESTApiUser<StudyUserQuestion>(usersQuestionsTable),
  StudyUserQuestionT,
  'STUDY',
  'STUDY',
);
