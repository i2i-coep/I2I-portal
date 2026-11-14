-- ============================================================================
-- EDIT REQUESTS: ADD AN "applied" TERMINAL STATUS
--
-- Lets a participant self-edit their team info once the Secretary approves
-- their request, without reopening the write-escalation hole closed in
-- 22_lock_down_write_escalation.sql. The actual write happens through a new
-- server-side route (app/api/participant/apply-team-edit) using the
-- service-role client, which re-checks ownership and that a matching
-- edit_requests row is genuinely 'approved' before writing anything — then
-- flips that row to 'applied' so the same approval can't be used twice.
-- A participant who wants to change something else needs a fresh request
-- and a fresh approval, same as before.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================================

alter table edit_requests drop constraint if exists edit_requests_status_check;
alter table edit_requests add constraint edit_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'applied'));
