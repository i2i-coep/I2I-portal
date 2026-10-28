-- ============================================================================
-- PHASE 2-UPLOADS: DELEGATED REVIEWER READ ACCESS
--
-- phase2_uploads_assigned_staff_read (13_phase2_uploads.sql) only grants
-- read access via project_assignments (the Phase 3 mentor/ambassador
-- relationship). A Phase 2 delegated reviewer uses a different table,
-- phase2_reviewer_assignments (19_phase2_reviewer_delegation.sql), and had
-- no storage read policy at all — meaning a delegated Ambassador/Chief
-- Ambassador could never actually open a team's pitch deck or bills
-- document, even though their review queue tries to show both.
--
-- Mirrors the existing phase1_uploads_reviewer_read pattern
-- (27_phase1_reviewer_delegation.sql) for this bucket.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================================

create policy phase2_uploads_reviewer_read on storage.objects
  for select
  using (
    bucket_id = 'phase2-uploads'
    and exists (
      select 1 from phase2_reviewer_assignments pra
      where pra.team_id::text = (storage.foldername(name))[1]
      and pra.staff_id = auth.uid()
    )
  );
