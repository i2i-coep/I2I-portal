-- ============================================================================
-- CHAT ENHANCEMENTS — MS Teams–style discussion board
--
-- Adds to discussion_messages: soft-edit (edited_at) and soft-delete
-- (deleted_at) — never hard-deleted, so "This message was deleted" still
-- shows in place, matching Teams' own behaviour and keeping an audit trail.
--
-- Adds message_reactions (one 👍 per person per message, toggled by
-- insert/delete) and message_reads (who has seen which message, for a
-- "Seen by ..." line under the latest message).
--
-- Run after 09_extended_rls.sql (uses is_team_member_or_staff()).
-- ============================================================================

alter table discussion_messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

-- Only the sender (or the Secretary) can edit/soft-delete their own message.
drop policy if exists discussion_sender_update on discussion_messages;
create policy discussion_sender_update on discussion_messages
  for update using (sender_auth_id = auth.uid() or is_secretary());

-- ----------------------------------------------------------------------------
-- MESSAGE REACTIONS — single emoji (👍, WhatsApp-style "like"), one per
-- person per message; toggling off is a delete, not a second row.
-- ----------------------------------------------------------------------------
create table if not exists message_reactions (
  id uuid primary key default gen_random_uuid()
);

alter table message_reactions
  add column if not exists message_id uuid references discussion_messages(id) on delete cascade,
  add column if not exists reactor_auth_id uuid references auth.users(id) on delete cascade,
  add column if not exists reactor_name text,
  add column if not exists emoji text not null default '👍',
  add column if not exists created_at timestamptz not null default now();

alter table message_reactions alter column message_id set not null;
alter table message_reactions alter column reactor_auth_id set not null;
alter table message_reactions alter column reactor_name set not null;

create unique index if not exists uq_message_reactions_one_per_person
  on message_reactions(message_id, reactor_auth_id);
create index if not exists idx_message_reactions_message on message_reactions(message_id);

alter table message_reactions enable row level security;

drop policy if exists message_reactions_visible_to_team on message_reactions;
create policy message_reactions_visible_to_team on message_reactions
  for select using (
    exists (
      select 1 from discussion_messages dm
      where dm.id = message_reactions.message_id and is_team_member_or_staff(dm.team_id)
    )
  );

drop policy if exists message_reactions_own_insert on message_reactions;
create policy message_reactions_own_insert on message_reactions
  for insert with check (
    reactor_auth_id = auth.uid()
    and exists (
      select 1 from discussion_messages dm
      where dm.id = message_reactions.message_id and is_team_member_or_staff(dm.team_id)
    )
  );

drop policy if exists message_reactions_own_delete on message_reactions;
create policy message_reactions_own_delete on message_reactions
  for delete using (reactor_auth_id = auth.uid());

-- ----------------------------------------------------------------------------
-- MESSAGE READS — "Seen by ..." under the latest message in the thread.
-- ----------------------------------------------------------------------------
create table if not exists message_reads (
  id uuid primary key default gen_random_uuid()
);

alter table message_reads
  add column if not exists message_id uuid references discussion_messages(id) on delete cascade,
  add column if not exists reader_auth_id uuid references auth.users(id) on delete cascade,
  add column if not exists reader_name text,
  add column if not exists read_at timestamptz not null default now();

alter table message_reads alter column message_id set not null;
alter table message_reads alter column reader_auth_id set not null;
alter table message_reads alter column reader_name set not null;

create unique index if not exists uq_message_reads_one_per_person
  on message_reads(message_id, reader_auth_id);
create index if not exists idx_message_reads_message on message_reads(message_id);

alter table message_reads enable row level security;

drop policy if exists message_reads_visible_to_team on message_reads;
create policy message_reads_visible_to_team on message_reads
  for select using (
    exists (
      select 1 from discussion_messages dm
      where dm.id = message_reads.message_id and is_team_member_or_staff(dm.team_id)
    )
  );

drop policy if exists message_reads_own_insert on message_reads;
create policy message_reads_own_insert on message_reads
  for insert with check (
    reader_auth_id = auth.uid()
    and exists (
      select 1 from discussion_messages dm
      where dm.id = message_reads.message_id and is_team_member_or_staff(dm.team_id)
    )
  );

-- ----------------------------------------------------------------------------
-- Make sure the new tables broadcast over Supabase Realtime, same as every
-- other live-updating table in this app. Wrapped in DO blocks so re-running
-- this file after it already succeeded doesn't error on "already a member".
-- ----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table message_reactions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table message_reads;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table discussion_messages;
exception when duplicate_object then null;
end $$;
