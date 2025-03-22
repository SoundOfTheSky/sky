import { convertToDate } from '@/services/db/convetrations'
import { createRestEndpointHandler, RESTApiUser } from '@/services/http/rest'
import { answersTable } from '@/services/study/answers'
import TABLES from '@/services/tables'
import { StudyAnswerT } from '@/sky-shared/study'

export default createRestEndpointHandler(
  new RESTApiUser(answersTable, {
    updated: {
      convertTo: (data) =>
        convertToDate(new Date(Number.parseInt(data) * 1000))!,
      sql: (m, p) => `${TABLES.STUDY_ANSWERS}.updated ${m} $${p}`,
    },
    user_id: {
      convertTo: (data) => Number.parseInt(data),
      sql: (m, p) => `${TABLES.STUDY_ANSWERS}.user_id ${m} $${p}`,
    },
  }),
  StudyAnswerT,
  'STUDY',
  'STUDY',
)
