import { DBTable, TableDefaults, TableDTO } from '../../db';
import { srsTable, SRSTable } from './srs';
import { themesTable, ThemesTable } from './themes';

export type Subject = TableDefaults & {
  srsId: number;
  themeId: number;
  title: string;
  questionsHaveToAnswer?: number;
};
export class SubjectsTable extends DBTable<
  Subject,
  TableDTO<Omit<Subject, 'questionsHaveToAnswer'>> & { questionsHaveToAnswer?: number }
> {
  private dependencyTables;
  constructor(
    table: string,
    dependencyTables: {
      srsTable: SRSTable;
      themesTable: ThemesTable;
    },
  ) {
    super(table, {
      srsId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: dependencyTables.srsTable.name,
          column: 'id',
        },
      },
      themeId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: dependencyTables.themesTable.name,
          column: 'id',
          onDelete: 'CASCADE',
        },
      },
      questionsHaveToAnswer: {
        type: 'INTEGER',
      },
      title: {
        type: 'TEXT',
        required: true,
      },
    });
    this.dependencyTables = dependencyTables;
  }
}
export const subjectsTable = new SubjectsTable('subjects', {
  srsTable,
  themesTable,
});
