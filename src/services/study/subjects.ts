import { DBTable, TableDefaults, TableDTO, DEFAULT_COLUMNS } from '@/services/db';
import { themesTable } from '@/services/study/themes';

export type Subject = TableDefaults & {
  srsId: number;
  themeId: number;
  title: string;
};
export type SubjectDTO = TableDTO<Subject>;
export class SubjectsTable extends DBTable<Subject, SubjectDTO> {
  constructor(table: string) {
    super(table, {
      ...DEFAULT_COLUMNS,
      srsId: {
        type: 'INTEGER',
        required: true,
      },
      themeId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: themesTable.name,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
      title: {
        type: 'TEXT',
        required: true,
      },
    });
  }
}
export const subjectsTable = new SubjectsTable('subjects');
