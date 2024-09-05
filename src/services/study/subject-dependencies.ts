import { DBTable, DEFAULT_COLUMNS } from '@/services/db';
import TABLES from '@/services/tables';
import { TableDefaults } from '@/sky-shared/db';
import { log } from '@/sky-utils';

log('Loaded', import.meta.path);

export type SubjectDependencies = TableDefaults & {
  percent: number;
  subjectId: number;
  dependencyId: number;
};
export class SubjectDependenciesTable extends DBTable<SubjectDependencies> {
  public constructor() {
    super(TABLES.STUDY_SUBJECT_DEPS, {
      ...DEFAULT_COLUMNS,
      percent: {
        type: 'INTEGER',
        required: true,
      },
      subjectId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: TABLES.STUDY_SUBJECTS,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
      dependencyId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: TABLES.STUDY_SUBJECTS,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
    });
  }
}
export const subjectDependenciesTable = new SubjectDependenciesTable();
