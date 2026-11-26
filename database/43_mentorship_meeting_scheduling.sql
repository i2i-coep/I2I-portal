-- ============================================================================
-- PHASE 3 MENTORSHIP: MEETING SCHEDULING, CONFIRMATION, IN-APP NOTIFICATIONS
--
-- Rebuilds the meetings flow per the Secretary's revised process:
--   1. Ambassador proposes a day/time to the team (meeting_proposals) —
--      a structured card, not just free-text chat.
--   2. Team accepts/declines.
--   3. Ambassador "raises" the meeting with a pasted Google Meet link
--      (manual link, not the Calendar API — avoids the OAuth verification
--      risk of an auto-generated one expiring mid-competition) and a
--      specific date + time (meetings.meeting_time is new; meeting_date
--      already existed).
--   4. The mentor can mark the meeting "confirmed" — purely a formality
--      badge, never a gate on the meeting happening.
--   5. Both the mentor and the team get an in-app notification the moment
--      it's raised (in_app_notifications — a new, first in-app
--      notification system, distinct from the email/WhatsApp
--      notification_queue).
--   6. After the meet, the mentor scores it 0-10 on 5 fixed criteria
--      (same averaging mechanic as the Phase 2 rubric) instead of the old
--      free-form `questions` array. The column names are placeholders —
--      the Secretary is sending the real 5 criteria separately; renaming
--      them later is a one-line change in the scoring UI, no new
--      migration needed since the column names themselves don't need to
--      match the display labels.
--
-- Run this after 09_extended_rls.sql (uses is_team_member_or_staff()).
-- ============================================================================

alter table meetings
  add column if not exists meeting_time time,
  add column if not exists meet_link text,
  add column if not exists mentor_confirmed boolean not null default false,
  add column if not exists mentor_confirmed_at timestamptz,
  add column if not exists score_criterion_1 numeric(4,2) check (score_criterion_1 is null or (score_criterion_1 between 0 and 10)),
  add column if not exists score_criterion_2 numeric(4,2) check (score_criterion_2 is null or (score_criterion_2 between 0 and 10)),
  add column if not exists score_criterion_3 numeric(4,2) check (score_criterion_3 is null or (score_criterion_3 between 0 and 10)),
  add column if not exists score_criterion_4 numeric(4,2) check (score_criterion_4 is null or (score_criterion_4 between 0 and 10)),
  add column if not exists score_criterion_5 numeric(4,2) check (score_criterion_5 is null or (score_criterion_5 between 0 and 10));

-- Ambassadors need to update a meeting they raised (e.g. fix the pasted
-- link), not just insert it. Row-scoped only, same trust model this table
-- already used for meetings_mentor_grade (no column guard trigger here).
-- drop-if-exists first everywhere in this file so it's safe to re-run after
-- a partial failure, rather than aborting on "policy already exists".
drop policy if exists meetings_ambassador_update on meetings;
create policy meetings_ambassador_update on meetings
  for update using (
    exists (
      select 1 from project_assignments
      where team_id = meetings.team_id and staff_id = auth.uid() and assignment_role = 'ambassador'
    )
    or is_secretary()
  );

-- ----------------------------------------------------------------------------
-- MEETING PROPOSALS — the structured "propose a time" card
-- ----------------------------------------------------------------------------
create table if not exists meeting_proposals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  proposed_by uuid not null references staff_profiles(id),
  proposed_date date not null,
  proposed_time time not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_meeting_proposals_team on meeting_proposals(team_id);

alter table meeting_proposals enable row level security;

drop policy if exists meeting_proposals_visible_to_team on meeting_proposals;
create policy meeting_proposals_visible_to_team on meeting_proposals
  for select using (is_team_member_or_staff(team_id));

drop policy if exists meeting_proposals_ambassador_insert on meeting_proposals;
create policy meeting_proposals_ambassador_insert on meeting_proposals
  for insert with check (
    exists (
      select 1 from project_assignments
      where team_id = meeting_proposals.team_id and staff_id = auth.uid() and assignment_role = 'ambassador'
    )
    or is_secretary()
  );

-- Team leader accepts/declines; the proposing ambassador can also update
-- (e.g. withdraw it before the team responds).
drop policy if exists meeting_proposals_respond on meeting_proposals;
create policy meeting_proposals_respond on meeting_proposals
  for update using (
    exists (select 1 from teams where id = team_id and leader_auth_id = auth.uid())
    or proposed_by = auth.uid()
    or is_secretary()
  );

-- ----------------------------------------------------------------------------
-- IN-APP NOTIFICATIONS — first in-app (not email/WhatsApp) notification
-- system. recipient_auth_id works uniformly for both a staff_profiles row
-- (id = auth id) and a team leader (leader_auth_id = auth id).
-- ----------------------------------------------------------------------------
create table if not exists in_app_notifications (
  id uuid primary key default gen_random_uuid()
);

-- Explicit ADD COLUMN IF NOT EXISTS for every column, not just inline in
-- the CREATE TABLE — makes this safe to re-run even if an earlier partial
-- run already created the table in some other shape.
alter table in_app_notifications
  add column if not exists recipient_auth_id uuid references auth.users(id) on delete cascade,
  add column if not exists type text,
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists team_id uuid references teams(id) on delete cascade,
  add column if not exists meeting_id uuid references meetings(id) on delete cascade,
  add column if not exists is_read boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

alter table in_app_notifications alter column recipient_auth_id set not null;
alter table in_app_notifications alter column type set not null;
alter table in_app_notifications alter column title set not null;

create index if not exists idx_in_app_notifications_recipient on in_app_notifications(recipient_auth_id, is_read, created_at);

alter table in_app_notifications enable row level security;

drop policy if exists in_app_notifications_own on in_app_notifications;
create policy in_app_notifications_own on in_app_notifications
  for select using (recipient_auth_id = auth.uid());

drop policy if exists in_app_notifications_mark_read on in_app_notifications;
create policy in_app_notifications_mark_read on in_app_notifications
  for update using (recipient_auth_id = auth.uid());

drop policy if exists in_app_notifications_secretary_read on in_app_notifications;
create policy in_app_notifications_secretary_read on in_app_notifications
  for select using (is_secretary());

-- No insert policy: these are written server-side via the admin/service-role
-- client only (same pattern as notification_queue), so a plain authenticated
-- user can never write a notification into someone else's inbox.
