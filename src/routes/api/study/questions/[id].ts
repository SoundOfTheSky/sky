import { createRestEndpointHandler, RESTApi } from '@/services/http/rest';
import { questionsTable } from '@/services/study/questions';
import { StudyQuestion, StudyQuestionT } from '@/sky-shared/study';

export default createRestEndpointHandler(new RESTApi<StudyQuestion>(questionsTable), StudyQuestionT, 'STUDY', 'ADMIN');
