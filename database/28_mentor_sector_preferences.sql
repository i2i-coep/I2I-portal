-- ============================================================================
-- MENTOR SECTOR PREFERENCES + AUTO-MATCH
--
-- Real-world process: after the seminar, interested Eaton employees fill a
-- form ranking all 6 sectors by preference. The Secretary bulk-imports that
-- list (creating each mentor's account) and the portal then automatically
-- allots each mentor a funded project in their sector — trying priority 1
-- first, falling back down their ranked list only where priority 1 has no
-- available project left. The mentor never sees an "unassigned" state they
-- have to wait on a human for; by the time they first log in, matching has
-- already run.
--
-- This sits alongside (not instead of) the existing project_assignments /
-- staff_assignment_capacity / enforce_assignment_rules machinery from
-- 06_phase3_automation.sql — the auto-match just decides WHICH mentor goes
-- to WHICH team, then inserts into project_assignments exactly like the
-- Secretary's manual "Assign Mentor & Ambassador" panel does, so the
-- existing capacity cap, notifications, and team-status auto-advance all
-- apply unchanged.
--
-- Run this after 27_phase1_reviewer_delegation.sql.
-- ============================================================================

create table mentor_sector_preferences (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  sector_id uuid not null references sectors(id),
  priority int not null check (priority between 1 and 6),
  created_at timestamptz not null default now(),
  unique (staff_id, sector_id),
  unique (staff_id, priority)
);

create index idx_mentor_sector_prefs_staff on mentor_sector_preferences(staff_id);

alter table mentor_sector_preferences enable row level security;

create policy mentor_sector_preferences_own_read on mentor_sector_preferences
  for select using (staff_id = auth.uid());

create policy mentor_sector_preferences_secretary_all on mentor_sector_preferences
  for all using (is_secretary()) with check (is_secretary());
