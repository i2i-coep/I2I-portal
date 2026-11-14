-- ============================================================================
-- ENFORCE THE PHASE 1 PITCH DECK SUBMISSION DEADLINE
--
-- phase1_submissions_leader_update (26_phase1_pitch_deck_upload.sql) let a
-- team leader update their submission with no deadline check at all — the
-- UI only ever checked opens_at (has it started), never closes_at (has it
-- ended), so a participant could keep replacing their pitch deck forever,
-- even after the Secretary's scheduled close date passed. Fixed at the
-- RLS layer (authoritative — not just the UI) so a direct API call can't
-- bypass it either. The Secretary's own access (phase1_submissions_secretary_all)
-- is untouched and always works regardless of this window.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================================

create or replace function phase1_submission_window_open()
returns boolean as $$
  select coalesce(
    (
      select (opens_at is null or opens_at <= now())
         and (closes_at is null or closes_at >= now())
      from phase_settings
      where phase_number = 1
    ),
    true
  );
$$ language sql stable;

drop policy if exists phase1_submissions_leader_update on phase1_submissions;
create policy phase1_submissions_leader_update on phase1_submissions
  for update using (
    exists (select 1 from teams where id = team_id and leader_auth_id = auth.uid())
    and phase1_submission_window_open()
  );
