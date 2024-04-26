import { DBTable, TableDefaults, DEFAULT_COLUMNS } from '@/services/db';

export type Theme = TableDefaults & {
  title: string;
};
export class ThemesTable extends DBTable<Theme> {
  constructor(table: string) {
    super(table, {
      ...DEFAULT_COLUMNS,
      title: {
        type: 'TEXT',
        required: true,
      },
    });
  }
}
export const themesTable = new ThemesTable('themes');
