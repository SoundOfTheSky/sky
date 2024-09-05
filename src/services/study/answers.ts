import {
  convertFromBoolean,
  convertToBoolean,
  convertToDate,
  DB,
  convertFromArray,
  convertToArray,
  DEFAULT_COLUMNS,
  DBTableWithUser,
} from '@/services/db';
import { usersSubjectsTable } from '@/services/study/users-subjects';
import TABLES from '@/services/tables';
import { Changes } from '@/sky-shared/db';
import { StudyAnswer, StudyAnswerDTO } from '@/sky-shared/study';

export class AnswersTable extends DBTableWithUser<StudyAnswer, StudyAnswerDTO> {
  public $deleteByUserTheme = DB.prepare<unknown, [number, number]>(
    `DELETE FROM ${this.name} WHERE id IN (
      SELECT a.id FROM ${this.name} a
      JOIN ${TABLES.STUDY_SUBJECTS} s ON s.id == a.subject_id
      WHERE s.theme_id = ? AND a.user_id = ?)`,
  );

  protected $getUserStats = DB.prepare<
    {
      created: number;
      theme_id: number;
      subject_id: number;
      correct: 1 | 0;
      answers: string;
      took: number;
    },
    [number, string, string]
  >(
    `SELECT unixepoch(ua.created) created, s.theme_id, ua.subject_id, ua.correct, ua.answers, ua.took
  FROM ${this.name} ua
  JOIN ${TABLES.STUDY_SUBJECTS} s ON s.id = ua.subject_id
  WHERE ua.user_id = ? AND ua.created > ? AND ua.created < ?`,
  );

  public constructor() {
    super(TABLES.STUDY_ANSWERS, {
      ...DEFAULT_COLUMNS,
      correct: {
        type: 'INTEGER',
        required: true,
        from: convertFromBoolean,
        to: convertToBoolean,
      },
      answers: {
        type: 'TEXT',
        from: convertFromArray,
        to: convertToArray,
      },
      took: {
        type: 'INTEGER',
        required: true,
      },
      userId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: TABLES.USERS,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
      subjectId: {
        type: 'INTEGER',
        required: true,
        ref: {
          table: TABLES.STUDY_SUBJECTS,
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
    });
  }

  public getUserStats(userId: number, start: number, end?: number) {
    return this.$getUserStats
      .all(userId, convertToDate(new Date(start * 1000))!, convertToDate(end ? new Date(end * 1000) : new Date())!)
      .map((x) => ({
        created: x.created,
        themeId: x.theme_id,
        subjectId: x.subject_id,
        correct: x.correct === 1,
        answers: convertFromArray(x.correct) as string[],
        took: x.took,
      }));
  }

  public create(data: StudyAnswerDTO): Changes {
    data.answers = data.answers.filter((x) => !['wrong', 'correct'].includes(x.toLowerCase()));
    const changes = answersTable.create(data);
    changes.changes += usersSubjectsTable.answer(data).changes;
    return changes;
  }
}
export const answersTable = new AnswersTable();
