-- ============================================================================
-- Reduce the Phase 1 pitch deck upload cap from 10MB to 5MB.
--
-- 26_phase1_pitch_deck_upload.sql already ran against the live database, so
-- editing that file's INSERT wouldn't change anything there — the bucket
-- already exists with the old limit. This updates it in place.
-- ============================================================================

update storage.buckets
set file_size_limit = 5242880 -- 5MB
where id = 'phase1-uploads';
