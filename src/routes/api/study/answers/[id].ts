import { createRestEndpointHandler, RESTApiUser } from '@/services/http/rest';
import { answersTable } from '@/services/study/answers';
import { StudyAnswer, StudyAnswerT } from '@/sky-shared/study';

export default createRestEndpointHandler(new RESTApiUser<StudyAnswer>(answersTable), StudyAnswerT, 'STUDY', 'STUDY');
