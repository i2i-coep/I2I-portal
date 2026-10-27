-- ============================================================================
-- RESTORE MISSING PHASE 1 UPLOADS STORAGE POLICIES
--
-- Diagnosed live via:
--   select policyname, qual from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--   and policyname like 'phase1_uploads%';
--
-- Only phase1_uploads_reviewer_read (27_phase1_reviewer_delegation.sql)
-- actually exists on the live project. The other three defined across
-- 26_phase1_pitch_deck_upload.sql and 29_phase1_submissions_cross_phase_read.sql
-- never took effect — most likely a partial/failed SQL Editor run at some
-- point. This explains both the Ambassador's and the Secretary's "Object
-- not found" when opening a Phase 1 pitch deck: there is currently no
-- is_secretary()-based storage rule at all, and (more seriously) a team
-- leader may not even be able to upload their own pitch deck right now.
--
-- Idempotent — safe to run even if some of these already exist.
-- Run this in the Supabase SQL Editor immediately.
-- ============================================================================

drop policy if exists phase1_uploads_leader_all on storage.objects;
create policy phase1_uploads_leader_all on storage.objects
  for all
  using (
    bucket_id = 'phase1-uploads'
    and exists (
      select 1 from teams t
      where t.id::text = (storage.foldername(name))[1]
      and t.leader_auth_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'phase1-uploads'
    and exists (
      select 1 from teams t
      where t.id::text = (storage.foldername(name))[1]
      and t.leader_auth_id = auth.uid()
    )
  );

drop policy if exists phase1_uploads_secretary_all on storage.objects;
create policy phase1_uploads_secretary_all on storage.objects
  for all
  using (bucket_id = 'phase1-uploads' and is_secretary())
  with check (bucket_id = 'phase1-uploads' and is_secretary());

drop policy if exists phase1_uploads_cross_phase_read on storage.objects;
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
