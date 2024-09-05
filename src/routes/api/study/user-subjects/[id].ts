import { createRestEndpointHandler, RESTApiUser } from '@/services/http/rest';
import { usersSubjectsTable } from '@/services/study/users-subjects';
import { StudyUserSubject, StudyUserSubjectT } from '@/sky-shared/study';

export default createRestEndpointHandler(
  new RESTApiUser<StudyUserSubject>(usersSubjectsTable),
  StudyUserSubjectT,
  'STUDY',
  'STUDY',
);
