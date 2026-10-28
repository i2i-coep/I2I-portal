-- ============================================================================
-- RESTORE 4 MISSING CORE RLS POLICIES
--
-- Found via a full audit (information_schema.tables/routines + pg_policies
-- cross-checked against every database/*.sql file): these 4 policies never
-- made it into the live database, even though the rest of their source
-- files did — most likely a partial copy/paste when those files were
-- originally run.
--
--   teams_public_insert       (03_rls_policies.sql) — lets anyone register a
--                              new team via the public /register page with
--                              no auth. Without this, direct self-service
--                              registration through the portal is broken
--                              (bulk import via the Secretary's spreadsheet
--                              uploader still works fine — it uses the
--                              service-role key, which bypasses RLS).
--   teams_leader_update_own   (03_rls_policies.sql) — lets a team leader
--                              update their own team row.
--   team_members_leader_insert(03_rls_policies.sql) — lets team members be
--                              inserted during public registration.
--   assignments_team_leader_read (18_fix_project_assignments_leader_read.sql)
--                              — lets a team leader see their own assigned
--                              mentor/ambassador.
--
-- Idempotent — safe to run even if any of these already exist.
-- Run this in the Supabase SQL Editor.
-- ============================================================================

drop policy if exists teams_public_insert on teams;
create policy teams_public_insert on teams
  for insert with check (true);

drop policy if exists teams_leader_update_own on teams;
create policy teams_leader_update_own on teams
  for update using (leader_auth_id = auth.uid());

drop policy if exists team_members_leader_insert on team_members;
create policy team_members_leader_insert on team_members
  for insert with check (true);

drop policy if exists assignments_team_leader_read on project_assignments;
create policy assignments_team_leader_read on project_assignments
  for select using (
    exists (
      select 1 from teams
      where id = project_assignments.team_id and leader_auth_id = auth.uid()
    )
  );
