import { convertToDate } from '@/services/db/convetrations'
import { createRestEndpointHandler, RESTApi } from '@/services/http/rest'
import { questionsTable } from '@/services/study/questions'
import TABLES from '@/services/tables'
import { StudyQuestion, StudyQuestionT } from '@/sky-shared/study'

export default createRestEndpointHandler(
  new RESTApi<StudyQuestion>(questionsTable, {
    updated: {
      convertTo: data =>
        convertToDate(new Date(Number.parseInt(data) * 1000))!,
      sql: (m, p) =>
        m === '<'
          ? `(${TABLES.STUDY_QUESTIONS}.updated ${m} $${p} AND (uq.updated IS NULL OR uq.updated ${m} $${p}))`
          : `(${TABLES.STUDY_QUESTIONS}.updated ${m} $${p} OR (uq.updated IS NOT NULL AND uq.updated ${m} $${p}))`,
    },
  }),
  StudyQuestionT,
  'STUDY',
  'ADMIN',
)
