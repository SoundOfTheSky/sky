import { convertFromNumberArray, convertToArray, DBTable, TableDefaults, defaultColumns } from '@/services/db';

export type SRS = TableDefaults & {
  title: string;
  timings: number[];
  ok: number;
};
export class SRSTable extends DBTable<SRS> {
  constructor(table: string) {
    super(table, {
      ...defaultColumns,
      title: {
        type: 'TEXT',
        required: true,
      },
      timings: {
        type: 'TEXT',
        required: true,
        from: convertFromNumberArray,
        to: convertToArray,
      },
      ok: {
        type: 'INTEGER',
        required: true,
      },
    });
  }
}
export const srsTable = new SRSTable('srs');
