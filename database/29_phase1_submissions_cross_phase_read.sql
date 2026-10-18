-- ============================================================================
-- CROSS-PHASE READ ACCESS FOR PHASE 1 PITCH DECKS
--
-- Pitch deck upload moved from Phase 2 to Phase 1 (26_phase1_pitch_deck_upload.sql),
-- but phase1_submissions' RLS only ever granted read to: the team leader,
-- the Secretary, and a specifically-delegated Phase 1 reviewer
-- (27_phase1_reviewer_delegation.sql). Anyone else who legitimately needs to
-- see a team's pitch deck during a later phase — a Phase 2 delegated
-- reviewer, or a Phase 3 assigned mentor/ambassador — had no access at all,
-- so their "View Pitch Deck" link would fail even once the app code points
-- at the right table/bucket.
--
-- Run this after 28_mentor_sector_preferences.sql.
-- ============================================================================

create policy phase1_submissions_cross_phase_read on phase1_submissions
  for select using (
    exists (
      select 1 from project_assignments pa
      where pa.team_id = phase1_submissions.team_id and pa.staff_id = auth.uid()
    )
    or exists (
      select 1 from phase2_reviewer_assignments pra
      where pra.team_id = phase1_submissions.team_id and pra.staff_id = auth.uid()
    )
  );

create policy phase1_uploads_cross_phase_read on storage.objects
  for select
  using (
    bucket_id = 'phase1-uploads'
    and (
      exists (
        select 1 from project_assignments pa
        where pa.team_id::text = (storage.foldername(name))[1]
        and pa.staff_id = auth.uid()
      )
      or exists (
        select 1 from phase2_reviewer_assignments pra
        where pra.team_id::text = (storage.foldername(name))[1]
        and pra.staff_id = auth.uid()
      )
    )
  );
