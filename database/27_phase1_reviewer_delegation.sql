-- ============================================================================
-- PHASE 1 REVIEWER DELEGATION + SCORING
--
-- Mirrors the existing Phase 2 reviewer-delegation pattern
-- (19_phase2_reviewer_delegation.sql) for Phase 1's PPT screening round:
-- the Secretary hands off specific teams to specific Ambassadors/Chief
-- Ambassadors, who then see exactly those teams in their own portal, view
-- the pitch deck, and give a 0-10 score. The Secretary later exports all
-- scores to a spreadsheet, decides Accept/Reject per project, and
-- re-uploads — bulk-advancing team.status, which already automatically
-- surfaces the congratulations banner / participation certificate.
--
-- Run this after 26_phase1_pitch_deck_upload.sql.
-- ============================================================================

create table phase1_reviewer_assignments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  assigned_by uuid references staff_profiles(id),
  assigned_at timestamptz not null default now(),
  unique (team_id, staff_id)
);

create index idx_phase1_reviewer_staff on phase1_reviewer_assignments(staff_id);
create index idx_phase1_reviewer_team on phase1_reviewer_assignments(team_id);

alter table phase1_reviewer_assignments enable row level security;

create policy phase1_reviewer_assignments_secretary_manage on phase1_reviewer_assignments
  for all using (is_secretary());

create policy phase1_reviewer_assignments_own_read on phase1_reviewer_assignments
  for select using (staff_id = auth.uid());

create or replace function is_phase1_reviewer(p_team_id uuid)
returns boolean as $$
  select exists (
    select 1 from phase1_reviewer_assignments
    where team_id = p_team_id and staff_id = auth.uid()
  );
$$ language sql stable security definer;

-- Reviewers need the team row itself (project code, name, college) for
-- their assigned projects.
create policy teams_phase1_reviewer_read on teams
  for select using (is_phase1_reviewer(id));

-- ----------------------------------------------------------------------------
-- Score column + reviewer read/write access to phase1_submissions.
-- ----------------------------------------------------------------------------
alter table phase1_submissions
  add column score integer check (score is null or (score between 0 and 10));

create policy phase1_submissions_reviewer_read on phase1_submissions
  for select using (is_phase1_reviewer(team_id));

create policy phase1_submissions_reviewer_update on phase1_submissions
  for update using (is_phase1_reviewer(team_id));

-- Extend the column guard from 26_phase1_pitch_deck_upload.sql: a
-- delegated reviewer may only ever write `score`, never the pitch deck
-- path or submission time (that's the owner's lane, enforced below it).
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
       (to_jsonb(new) - 'score' - 'updated_at') is distinct from (to_jsonb(old) - 'score' - 'updated_at')
    then
      raise exception 'Reviewers may only set the score.';
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

-- ----------------------------------------------------------------------------
-- Storage: a delegated reviewer can view (not overwrite) the pitch deck
-- for their assigned projects — same read-only pattern as Phase 2's
-- phase2_uploads_assigned_staff_read.
-- ----------------------------------------------------------------------------
create policy phase1_uploads_reviewer_read on storage.objects
  for select
  using (
    bucket_id = 'phase1-uploads'
    and exists (
      select 1 from phase1_reviewer_assignments pra
      where pra.team_id::text = (storage.foldername(name))[1]
      and pra.staff_id = auth.uid()
    )
  );
