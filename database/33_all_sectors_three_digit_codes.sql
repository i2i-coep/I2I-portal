-- ============================================================================
-- ALL SECTORS: 3-DIGIT PROJECT CODES
--
-- 32_per_sector_project_code_digits.sql only widened HHH and INN to 3
-- digits (the two sectors actually over 100 registrations), keeping the
-- rest at 2-digit. Secretary now wants every sector's codes to end in 3
-- digits uniformly (e.g. AGR2026001, not AGR202601), regardless of how
-- many registrations that sector has.
--
-- generate_project_code() (from 32_...) already reads sectors.code_digits
-- per sector, so this is just a data + default change — no function
-- rewrite needed.
--
-- Run this in the Supabase SQL Editor BEFORE bulk-importing the real Phase 1
-- registrations — changing it after codes already exist does not
-- retroactively reformat already-assigned codes.
-- ============================================================================

alter table sectors alter column code_digits set default 3;

update sectors set code_digits = 3;
