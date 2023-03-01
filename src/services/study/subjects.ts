import { DBTable, TableDefaults, TableDTO, defaultColumns } from '@/services/db';
import { srsTable } from '@/services/study/srs';
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
      ...defaultColumns,
      srsId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: srsTable.name,
          column: 'id',
        },
      },
      themeId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: themesTable.name,
          column: 'id',
          onDelete: 'CASCADE',
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
