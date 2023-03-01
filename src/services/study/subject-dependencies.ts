import { DB, DBTable, TableDefaults } from '../../db';
import { subjectsTable, SubjectsTable } from './subjects';

export type SubjectDependencies = TableDefaults & {
  percent: number;
  subjectId: number;
  dependencyId: number;
};
export class SubjectDependenciesTable extends DBTable<SubjectDependencies> {
  private dependencyTables;
  constructor(
    table: string,
    dependencyTables: {
      subjectsTable: SubjectsTable;
    },
  ) {
    super(table, {
      percent: {
        type: 'INTEGER',
        required: true,
      },
      subjectId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: dependencyTables.subjectsTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
      dependencyId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: dependencyTables.subjectsTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
    });
    this.dependencyTables = dependencyTables;
  }

  clearDuplicateDependencies() {
    const duplicates = DB.prepare(
      `SELECT * FROM (SELECT COUNT(*) c, GROUP_CONCAT(id) ids, GROUP_CONCAT(percent) p
        FROM subject_dependencies
        GROUP BY subject_id, dependency_id)
        WHERE c>1
      `,
    )
      .all()
      .map((el) => ({
        ids: (el['ids'] as string).split(',').map((a: string) => +a),
        p: (el['p'] as string).split(',').map((a: string) => +a),
      }))
      .flatMap((el) =>
        el.p
          .map((p: number, i: number) => ({
            p,
            id: el.ids[i]!,
          }))
          .sort((a: { p: number }, b: { p: number }) => b.p - a.p)
          .slice(1)
          .map((el) => el.id),
      );
    for (const dup of duplicates) this.delete(dup);
  }

  deleteAllForSubject(subjectId: number) {
    return DB.prepare(`DELETE FROM ${this.name} WHERE subject_id = ? OR dependency_id = ?`).run(subjectId, subjectId);
  }
}
export const subjectDependenciesTable = new SubjectDependenciesTable('subject_dependencies', {
  subjectsTable,
});
