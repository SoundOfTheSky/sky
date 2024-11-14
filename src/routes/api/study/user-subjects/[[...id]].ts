import { convertToDate } from '@/services/db/convetrations'
import { createRestEndpointHandler, RESTApiUser } from '@/services/http/rest'
import { usersSubjectsTable } from '@/services/study/users-subjects'
import TABLES from '@/services/tables'
import { StudyUserSubject, StudyUserSubjectT } from '@/sky-shared/study'

export default createRestEndpointHandler(
  new RESTApiUser<StudyUserSubject>(usersSubjectsTable, {
    updated: {
      convertTo: data =>
        convertToDate(new Date(Number.parseInt(data) * 1000))!,
      sql: (m, p) => `${TABLES.STUDY_USERS_SUBJECTS}.updated ${m} $${p}`,
    },
    user_id: {
      convertTo: data => Number.parseInt(data),
      sql: (m, p) => `${TABLES.STUDY_USERS_SUBJECTS}.user_id ${m} $${p}`,
    },
  }),
  StudyUserSubjectT,
  'STUDY',
  'STUDY',
)
