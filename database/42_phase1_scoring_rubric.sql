-- ============================================================================
-- PHASE 1 SCORING RUBRIC — 5 CRITERIA, AVERAGED INTO THE FINAL SCORE
--
-- Reviewers (Ambassadors/Chief Ambassadors) previously typed a single raw
-- 0-10 score per project. Per the Secretary's revised process, they now
-- grade each project on 5 separate criteria (0-10 each), and the stored
-- `score` becomes the computed average of all 5 (total/5) rather than a
-- directly-entered number — so the Secretary's master spreadsheet keeps
-- showing one final "Score (/10)" column exactly as before, with no export
-- changes needed.
--
-- `score` moves from integer to numeric(4,2) since an average of five
-- integers is usually fractional (e.g. (8+7+9+6+8)/5 = 7.60).
--
-- Run this in the Supabase SQL Editor.
-- ============================================================================

alter table phase1_submissions drop constraint if exists phase1_submissions_score_check;
alter table phase1_submissions alter column score type numeric(4,2);
alter table phase1_submissions add constraint phase1_submissions_score_check
  check (score is null or (score between 0 and 10));

alter table phase1_submissions
  add column if not exists score_innovation numeric(4,2)
    check (score_innovation is null or (score_innovation between 0 and 10)),
  add column if not exists score_social_impact numeric(4,2)
    check (score_social_impact is null or (score_social_impact between 0 and 10)),
  add column if not exists score_feasibility numeric(4,2)
    check (score_feasibility is null or (score_feasibility between 0 and 10)),
  add column if not exists score_scalability numeric(4,2)
    check (score_scalability is null or (score_scalability between 0 and 10)),
  add column if not exists score_problem_understanding numeric(4,2)
    check (score_problem_understanding is null or (score_problem_understanding between 0 and 10));

-- Extend the reviewer column-guard allowlist (27_phase1_reviewer_delegation.sql)
-- to the 5 new rubric columns — a delegated reviewer may still only ever
-- write scoring columns, never the pitch deck path or submission time.
create or replace function enforce_phase1_column_guard()
returns trigger as $$
declare
  is_owner boolean;
  is_reviewer boolean;
begin
  if auth.uid() is null or is_secretary() then
    return new;
  end if;

  is_owner := exists (select 1 from teams where id = new.team_id and leader_auth_id = auth.uid());
  is_reviewer := is_phase1_reviewer(new.team_id);

  if is_reviewer and not is_owner then
    if TG_OP = 'UPDATE' and
       (to_jsonb(new) - 'score' - 'score_innovation' - 'score_social_impact' - 'score_feasibility'
          - 'score_scalability' - 'score_problem_understanding' - 'updated_at')
       is distinct from
       (to_jsonb(old) - 'score' - 'score_innovation' - 'score_social_impact' - 'score_feasibility'
          - 'score_scalability' - 'score_problem_understanding' - 'updated_at')
    then
      raise exception 'Reviewers may only set scores.';
    end if;
    return new;
  end if;

  if is_owner then
    if TG_OP = 'UPDATE' then
      if (to_jsonb(new) - 'pitch_deck_url' - 'submitted_at' - 'updated_at')
          is distinct from
         (to_jsonb(old) - 'pitch_deck_url' - 'submitted_at' - 'updated_at')
      then
        raise exception 'You can only update your own pitch deck submission.';
      end if;
    end if;
    return new;
  end if;

  raise exception 'Not authorized to modify this submission.';
end;
$$ language plpgsql security definer;
