-- ============================================================================
-- RESTORE MISSING PHASE2-UPLOADS STORAGE POLICIES
--
-- Confirmed live via:
--   select policyname, qual from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--   and policyname like 'phase2_uploads%';
-- → 0 rows. 13_phase2_uploads.sql never actually ran against this project
-- (same root cause as phase1-uploads in 34_... and 35_...) — the bucket
-- didn't exist (fixed in 35_create_missing_storage_buckets.sql) and none
-- of its three storage.objects policies existed either.
--
-- Without these, team leaders cannot upload bills/passbook/PAN/pitch video/
-- other Phase 2 (3.0) documents, the Secretary cannot view them, and
-- assigned mentors/ambassadors cannot view them.
--
-- Idempotent — safe to run even if some of these already exist.
-- Run this in the Supabase SQL Editor immediately, after 35_... .
-- ============================================================================

drop policy if exists phase2_uploads_leader_all on storage.objects;
create policy phase2_uploads_leader_all on storage.objects
  for all
  using (
    bucket_id = 'phase2-uploads'
    and exists (
      select 1 from teams t
      where t.id::text = (storage.foldername(name))[1]
      and t.leader_auth_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'phase2-uploads'
    and exists (
      select 1 from teams t
      where t.id::text = (storage.foldername(name))[1]
      and t.leader_auth_id = auth.uid()
    )
  );

drop policy if exists phase2_uploads_secretary_all on storage.objects;
create policy phase2_uploads_secretary_all on storage.objects
  for all
  using (bucket_id = 'phase2-uploads' and is_secretary())
  with check (bucket_id = 'phase2-uploads' and is_secretary());

drop policy if exists phase2_uploads_assigned_staff_read on storage.objects;
create policy phase2_uploads_assigned_staff_read on storage.objects
  for select
  using (
    bucket_id = 'phase2-uploads'
    and exists (
      select 1 from project_assignments pa
      join teams t on t.id = pa.team_id
      where t.id::text = (storage.foldername(name))[1]
      and pa.staff_id = auth.uid()
    )
  );
