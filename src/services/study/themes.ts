import { DBTable, TableDefaults, defaultColumns } from '@/services/db';

export type Theme = TableDefaults & {
  title: string;
};
export class ThemesTable extends DBTable<Theme> {
  constructor(table: string) {
    super(table, {
      ...defaultColumns,
      title: {
        type: 'TEXT',
        required: true,
      },
    });
  }
}
export const themesTable = new ThemesTable('themes');
