import { convertToDate } from '@/services/db/convetrations';
import { createRestEndpointHandler, RESTApi } from '@/services/http/rest';
import { subjectsTable } from '@/services/study/subjects';
import TABLES from '@/services/tables';
import { StudySubjectT } from '@/sky-shared/study';

export default createRestEndpointHandler(
  new RESTApi(
    subjectsTable,
    {
      updated: {
        convertTo: (data) => convertToDate(new Date(Number.parseInt(data) * 1000))!,
        sql: (m, p) =>
          `(${TABLES.STUDY_SUBJECTS}.updated ${m} $${p} AND q.updated ${m} $${p} AND (us.updated IS NULL OR us.updated ${m} $${p}))`,
      },
    },
    {
      updated: [TABLES.STUDY_SUBJECTS + '.updated', 'q.updated', 'us.updated'],
    },
  ),
  StudySubjectT,
  'STUDY',
  'ADMIN',
);
