import { createRestEndpointHandler, RESTApi } from '@/services/http/rest';
import { subjectsTable } from '@/services/study/subjects';
import { StudySubject, StudySubjectT } from '@/sky-shared/study';

export default createRestEndpointHandler(new RESTApi<StudySubject>(subjectsTable), StudySubjectT, 'STUDY', 'ADMIN');
