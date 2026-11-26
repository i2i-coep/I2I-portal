// Per-week mentor scoring criteria. Each of the 8 mentorship meets has its
// own 5 grading parameters (per the Secretary's explicit requirement — "all
// 8 meets will have different grading parameters"). The real wording for
// each week hasn't been given yet, so every label below is a clearly-marked
// placeholder; swap the `label` strings once the real ones arrive. The
// underlying column names (score_criterion_1..5) never change, so this is
// a one-line edit per label, no new migration needed.
export const MEETING_TYPES = [
  "Meet 1",
  "Meet 2",
  "Meet 3",
  "Meet 4",
  "Meet 5",
  "Meet 6",
  "Meet 7",
  "Meet 8",
] as const;

export type CriterionKey =
  | "score_criterion_1"
  | "score_criterion_2"
  | "score_criterion_3"
  | "score_criterion_4"
  | "score_criterion_5";

export type ScoreCriterion = { key: CriterionKey; label: string };

const CRITERION_KEYS: CriterionKey[] = [
  "score_criterion_1",
  "score_criterion_2",
  "score_criterion_3",
  "score_criterion_4",
  "score_criterion_5",
];

function placeholderSet(weekNumber: number): ScoreCriterion[] {
  return CRITERION_KEYS.map((key, i) => ({
    key,
    label: `Week ${weekNumber} · Criterion ${i + 1} (placeholder)`,
  }));
}

export const MEETING_CRITERIA_BY_TYPE: Record<string, ScoreCriterion[]> = Object.fromEntries(
  MEETING_TYPES.map((type, i) => [type, placeholderSet(i + 1)])
);

export function getCriteriaForMeetingType(meetingType: string): ScoreCriterion[] {
  return MEETING_CRITERIA_BY_TYPE[meetingType] ?? placeholderSet(0);
}
