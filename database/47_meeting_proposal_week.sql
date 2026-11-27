-- ============================================================================
-- Tag each meeting proposal with which week it's for, so the Ambassador's
-- "Propose a Time" can't go in without specifying which of the 8 meets the
-- proposed date is for, and so an accepted-but-unraised proposal can show
-- up directly inside that week's own card instead of a separate generic
-- list.
-- ============================================================================

alter table meeting_proposals
  add column if not exists meeting_type text;
