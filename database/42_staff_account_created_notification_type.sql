-- ============================================================================
-- ADD "staff_account_created" TO THE notification_type ENUM
--
-- Ambassador/Chief Ambassador bulk import created accounts silently — no
-- email was ever queued, so the ~70 Ambassadors from the FY bulk import
-- would never be told their login. notification_queue.type is a Postgres
-- enum (not plain text), so a new value needs its own migration before any
-- row can be inserted with type = 'staff_account_created'.
--
-- Run this in the Supabase SQL Editor BEFORE re-importing Ambassadors —
-- otherwise the notification_queue insert in the import route fails.
-- ============================================================================

alter type notification_type add value if not exists 'staff_account_created';
