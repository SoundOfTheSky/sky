import { DBTable, DEFAULT_COLUMNS } from '@/services/db';
import TABLES from '@/services/tables';
import { StudyTheme } from '@/sky-shared/study';

export class ThemesTable extends DBTable<StudyTheme> {
  public constructor() {
    super(TABLES.STUDY_THEMES, {
      ...DEFAULT_COLUMNS,
      title: {
        type: 'TEXT',
        required: true,
      },
    });
  }
}
export const themesTable = new ThemesTable();
