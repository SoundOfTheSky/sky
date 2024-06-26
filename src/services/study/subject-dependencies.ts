import { DBTable, TableDefaults, DEFAULT_COLUMNS } from '@/services/db';
import { subjectsTable } from '@/services/study/subjects';

export type SubjectDependencies = TableDefaults & {
  percent: number;
  subjectId: number;
  dependencyId: number;
};
export class SubjectDependenciesTable extends DBTable<SubjectDependencies> {
  constructor(table: string) {
    super(table, {
      ...DEFAULT_COLUMNS,
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
          onUpdate: 'CASCADE',
        },
      },
      dependencyId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: subjectsTable.name,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
    });
  }
}
export const subjectDependenciesTable = new SubjectDependenciesTable('subject_dependencies');
