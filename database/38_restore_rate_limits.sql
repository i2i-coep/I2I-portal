-- ============================================================================
-- RESTORE RATE LIMITING (never ran at all)
--
-- Found via the same audit: neither the rate_limits table nor the
-- check_rate_limit() function exist live, even though 25_rate_limits.sql
-- defines both. lib/rate-limit.ts calls this RPC and deliberately fails
-- OPEN (allows the request) when the call errors, so this gap has been
-- silently disabling rate limiting on /api/register, /api/raise-query,
-- and the login rate-limit-check endpoint this whole time, with no
-- visible symptom.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================================

create table if not exists rate_limits (
  key text primary key,
  count int not null default 1,
  window_start timestamptz not null default now()
);

alter table rate_limits enable row level security;

create or replace function check_rate_limit(p_key text, p_max_count int, p_window_seconds int)
returns boolean as $$
declare
  v_count int;
begin
  insert into rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    count = case
      when rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval
        then 1
        else rate_limits.count + 1
    end,
    window_start = case
      when rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval
        then now()
        else rate_limits.window_start
    end
  returning count into v_count;

  return v_count <= p_max_count;
end;
$$ language plpgsql security definer;
