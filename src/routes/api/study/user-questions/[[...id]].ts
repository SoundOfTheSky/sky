import { convertToDate } from '@/services/db/convetrations'
import { createRestEndpointHandler, RESTApiUser } from '@/services/http/rest'
import { usersQuestionsTable } from '@/services/study/users-questions'
import TABLES from '@/services/tables'
import { StudyUserQuestion, StudyUserQuestionT } from '@/sky-shared/study'

export default createRestEndpointHandler(
  new RESTApiUser<StudyUserQuestion>(usersQuestionsTable, {
    updated: {
      convertTo: (data) =>
        convertToDate(new Date(Number.parseInt(data) * 1000))!,
      sql: (m, p) => `${TABLES.STUDY_USERS_QUESTIONS}.updated ${m} $${p}`,
    },
    user_id: {
      convertTo: (data) => Number.parseInt(data),
      sql: (m, p) => `${TABLES.STUDY_USERS_QUESTIONS}.user_id ${m} $${p}`,
    },
  }),
  StudyUserQuestionT,
  'STUDY',
  'STUDY',
)
