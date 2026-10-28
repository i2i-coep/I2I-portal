-- ============================================================================
-- CREATE MISSING STORAGE BUCKETS
--
-- Root cause finally confirmed: Storage → Files in the dashboard shows ZERO
-- buckets exist on this project. Neither phase1-uploads nor phase2-uploads
-- was ever actually created, despite 13_phase2_uploads.sql and
-- 26_phase1_pitch_deck_upload.sql both containing the insert statement —
-- those statements apparently never ran (or were dropped) even though the
-- RLS policies from those same files DID get created (policies live on
-- storage.objects and don't require the bucket to exist first, which is
-- why this wasn't obvious from a policy check alone).
--
-- This means EVERY upload — Phase 1 pitch decks, Phase 2/3.0 bills,
-- passbooks, PAN, final pitch deck, bank docs — has been silently failing
-- for any real participant who tried, this whole time.
--
-- Run this in the Supabase SQL Editor immediately. Idempotent (on conflict
-- do update) — safe even if one of these somehow already exists.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('phase1-uploads', 'phase1-uploads', false, 5242880) -- 5MB, matches 30_reduce_phase1_upload_limit.sql
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

insert into storage.buckets (id, name, public, file_size_limit)
values ('phase2-uploads', 'phase2-uploads', false, 104857600) -- 100MB, matches 13_phase2_uploads.sql
on conflict (id) do update set file_size_limit = excluded.file_size_limit;
