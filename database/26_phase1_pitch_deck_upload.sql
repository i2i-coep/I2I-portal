-- ============================================================================
-- PHASE 1 PITCH DECK (PPT) UPLOAD
--
-- The real competition flow is: all registered teams submit a pitch deck
-- *before* the Secretary (and ambassadors) decide who advances to Phase 2 —
-- not after, which is what phase2_applications.pitch_deck_url was wired for.
-- This adds a small sibling table + bucket for that pre-selection submission,
-- following the same pattern as phase2_applications/phase4_submissions
-- rather than reopening the `teams` table's write-escalation lockdown from
-- 22_lock_down_write_escalation.sql (team leaders still have zero direct
-- UPDATE access to `teams` — intentionally left that way).
--
-- Run this after 25_rate_limits.sql.
-- ============================================================================

create table if not exists phase1_submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references teams(id) on delete cascade,
  pitch_deck_url text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_phase1_submissions_updated_at
  before update on phase1_submissions
  for each row execute function touch_updated_at();

alter table phase1_submissions enable row level security;

create policy phase1_submissions_leader_select on phase1_submissions
  for select using (
    exists (select 1 from teams where id = team_id and leader_auth_id = auth.uid())
  );

create policy phase1_submissions_leader_insert on phase1_submissions
  for insert with check (
    exists (select 1 from teams where id = team_id and leader_auth_id = auth.uid())
  );

create policy phase1_submissions_leader_update on phase1_submissions
  for update using (
    exists (select 1 from teams where id = team_id and leader_auth_id = auth.uid())
  );

create policy phase1_submissions_secretary_all on phase1_submissions
  for all using (is_secretary()) with check (is_secretary());

-- Column guard: a leader may only ever write their own pitch deck path +
-- submission time, never anything that would later exist on this table.
create or replace function enforce_phase1_column_guard()
returns trigger as $$
begin
  if auth.uid() is null or is_secretary() then
    return new;
  end if;

  if not exists (select 1 from teams where id = new.team_id and leader_auth_id = auth.uid()) then
    raise exception 'Not authorized to modify this submission.';
  end if;

  if TG_OP = 'UPDATE' then
    if (to_jsonb(new) - 'pitch_deck_url' - 'submitted_at' - 'updated_at')
        is distinct from
       (to_jsonb(old) - 'pitch_deck_url' - 'submitted_at' - 'updated_at')
    then
      raise exception 'You can only update your own pitch deck submission.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_phase1_column_guard
  before insert or update on phase1_submissions
  for each row execute function enforce_phase1_column_guard();

-- ----------------------------------------------------------------------------
-- Storage: private bucket, PDF-only pitch decks. 10 MB ceiling keeps the
-- aggregate footprint for ~550 submissions well within reach even on a
-- modest plan (worst case 550 x 10MB = 5.5GB; realistic average far less).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('phase1-uploads', 'phase1-uploads', false, 10485760)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- Path convention: phase1-uploads/{team_id}/{filename}
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

create policy phase1_uploads_secretary_all on storage.objects
  for all
  using (bucket_id = 'phase1-uploads' and is_secretary())
  with check (bucket_id = 'phase1-uploads' and is_secretary());
