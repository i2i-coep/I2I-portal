-- ============================================================================
-- AMBASSADOR MEETING SCORING + MINUTES OF MEETING
--
-- Per last year's reference sheet ("Grading parameters" tab), 3 separate
-- parties graded every meet, each with their own fixed 5-6 criteria:
-- Mentor (criteria change per meet — see 43_mentorship_meeting_scheduling.sql
-- for why those columns are placeholders), Ambassador (criteria about
-- meeting conduct — punctuality, participation, etc., SAME every meet), and
-- Head (criteria about team coordination — SAME every meet). This migration
-- adds the Ambassador side now, per the Secretary's explicit request; Head
-- scoring is a separate open question raised back to the Secretary — not
-- added here, since it was never asked for and would be a bigger change
-- (no Head<->team relationship exists anywhere in the schema yet).
--
-- Also adds "Minutes of meeting" fields (attendee count + a free-text
-- summary), which the reference sheet shows gets filled in per meet,
-- separately from the scoring.
--
-- Column names are placeholders — the Secretary is sending the real
-- Ambassador criteria "tomorrow"; swapping labels later is a one-line UI
-- change, not a new migration.
--
-- Run this after 43_mentorship_meeting_scheduling.sql.
-- ============================================================================

alter table meetings
  add column if not exists ambassador_score numeric(4,2) check (ambassador_score is null or (ambassador_score between 0 and 10)),
  add column if not exists ambassador_score_criterion_1 numeric(4,2) check (ambassador_score_criterion_1 is null or (ambassador_score_criterion_1 between 0 and 10)),
  add column if not exists ambassador_score_criterion_2 numeric(4,2) check (ambassador_score_criterion_2 is null or (ambassador_score_criterion_2 between 0 and 10)),
  add column if not exists ambassador_score_criterion_3 numeric(4,2) check (ambassador_score_criterion_3 is null or (ambassador_score_criterion_3 between 0 and 10)),
  add column if not exists ambassador_score_criterion_4 numeric(4,2) check (ambassador_score_criterion_4 is null or (ambassador_score_criterion_4 between 0 and 10)),
  add column if not exists ambassador_score_criterion_5 numeric(4,2) check (ambassador_score_criterion_5 is null or (ambassador_score_criterion_5 between 0 and 10)),
  add column if not exists members_present int,
  add column if not exists minutes_notes text;

-- Note: the existing meetings.ambassador_score column from
-- 08_extended_schema.sql (the old free-form "quick score" field) is being
-- reused here as the computed average of the 5 criteria above — no rename
-- needed, it was already nullable and unused by any current UI.
