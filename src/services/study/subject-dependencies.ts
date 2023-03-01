import { DBTable, TableDefaults, defaultColumns } from '@/services/db';
import { subjectsTable } from '@/services/study/subjects';

export type SubjectDependencies = TableDefaults & {
  percent: number;
  subjectId: number;
  dependencyId: number;
};
export class SubjectDependenciesTable extends DBTable<SubjectDependencies> {
  constructor(table: string) {
    super(table, {
      ...defaultColumns,
      percent: {
        type: 'INTEGER',
        required: true,
      },
      subjectId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: subjectsTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
      dependencyId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: subjectsTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
    });
  }
}
export const subjectDependenciesTable = new SubjectDependenciesTable('subject_dependencies');
