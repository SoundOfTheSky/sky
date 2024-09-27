import { createRestEndpointHandler, RESTApiUser } from '@/services/http/rest';
import { answersTable } from '@/services/study/answers';
import { StudyAnswerT } from '@/sky-shared/study';

export default createRestEndpointHandler(new RESTApiUser(answersTable), StudyAnswerT, 'STUDY', 'STUDY');
