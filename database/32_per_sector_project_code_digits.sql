-- ============================================================================
-- PER-SECTOR PROJECT CODE DIGIT WIDTH
--
-- 11_revert_project_code_format.sql locked project codes to a 2-digit,
-- 99-per-sector-per-year cap ("do not change the padding"). The real 2026
-- registration data (522 rows) shows two sectors over that cap:
--   Innovation & Technology (INN) — 195
--   3H - Health, Hunger & Humanity (HHH) — 101
-- Everyone else stays well under 100 (AGR 78, EDU 55, ENT 51, ENV 42).
--
-- Rather than bump every sector back to 3-digit (which was explicitly
-- rejected before), this adds a per-sector digit width so only the two
-- oversubscribed sectors get 3-digit codes (HHH2026001, INN2026001, ...)
-- while the rest keep the official 2-digit format (AGR202601, ...).
--
-- Run this in the Supabase SQL Editor BEFORE bulk-importing the real Phase 1
-- registrations (phase1-import), so codes are generated correctly the first
-- time — changing it after codes already exist would not retroactively fix
-- already-assigned codes.
-- ============================================================================

alter table sectors add column if not exists code_digits int not null default 2;

update sectors set code_digits = 3 where prefix in ('HHH', 'INN');

create or replace function generate_project_code()
returns trigger as $$
declare
  v_prefix text;
  v_digits int;
  v_year int;
  v_next int;
  v_code text;
begin
  if new.project_code is not null then
    return new;
  end if;

  select prefix, code_digits into v_prefix, v_digits from sectors where id = new.sector_id;
  if v_prefix is null then
    raise exception 'Invalid sector_id: no matching sector found';
  end if;

  v_year := new.registration_year;

  insert into project_code_counters (sector_id, year, last_number)
  values (new.sector_id, v_year, 1)
  on conflict (sector_id, year)
  do update set last_number = project_code_counters.last_number + 1
  returning last_number into v_next;

  if v_next > (power(10, v_digits) - 1) then
    raise exception
      'Sector % has exceeded % registrations for %. Bump code_digits for this sector in the sectors table.',
      v_prefix, power(10, v_digits) - 1, v_year;
  end if;

  v_code := v_prefix || v_year::text || lpad(v_next::text, v_digits, '0');
  new.project_code := v_code;

  return new;
end;
$$ language plpgsql;
