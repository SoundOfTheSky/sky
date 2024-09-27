import { createRestEndpointHandler, RESTApi } from '@/services/http/rest';
import { subjectsTable } from '@/services/study/subjects';
import { StudySubjectT } from '@/sky-shared/study';

export default createRestEndpointHandler(new RESTApi(subjectsTable), StudySubjectT, 'STUDY', 'ADMIN');
