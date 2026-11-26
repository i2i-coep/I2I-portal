-- ============================================================================
-- WEEKLY TIMELINE PLAN — replaces the old daily free-text timeline_entries
--
-- Per last year's reference sheet's "Timeline" tab: each team downloads a
-- blank template (Date Range, Week, Focus Area, Key Task, Mentor's Role,
-- Done), fills it in offline with their own project-specific weekly plan,
-- and uploads it back. Re-uploading replaces the team's entire plan
-- (the upload route deletes old rows first) rather than merging, since a
-- revised plan supersedes the old one wholesale.
--
-- The old timeline_entries table (daily free-text log) is left in place
-- un-dropped — it's no longer read or written anywhere in the app after
-- this migration, but dropping a live table during a running competition
-- is an unnecessary risk for zero benefit. Clean it up later if wanted.
--
-- Run this after 44_meeting_ambassador_scoring_and_minutes.sql.
-- ============================================================================

create table if not exists timeline_plan_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  week_number int not null,
  date_range text not null,
  focus_area text,
  key_task text not null,
  mentor_role text,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_timeline_plan_entries_team on timeline_plan_entries(team_id, week_number);

alter table timeline_plan_entries enable row level security;

create policy timeline_plan_visible_to_team on timeline_plan_entries
  for select using (is_team_member_or_staff(team_id));

-- Leader-only insert/delete (the upload route re-derives team_id from
-- leader_auth_id server-side, same pattern as apply-team-edit — never
-- trusts a client-supplied team_id).
create policy timeline_plan_leader_insert on timeline_plan_entries
  for insert with check (
    exists (select 1 from teams where id = team_id and leader_auth_id = auth.uid())
  );

create policy timeline_plan_leader_delete on timeline_plan_entries
  for delete using (
    exists (select 1 from teams where id = team_id and leader_auth_id = auth.uid())
  );

-- The team (and only the team) can tick off their own tasks as done.
create policy timeline_plan_leader_update on timeline_plan_entries
  for update using (
    exists (select 1 from teams where id = team_id and leader_auth_id = auth.uid())
  );

create policy timeline_plan_secretary_all on timeline_plan_entries
  for all using (is_secretary());
