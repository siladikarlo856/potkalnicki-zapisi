-- Content files retired (PR 14, step 1 of the contract): a correction no longer needs target_ref.
--
-- Corrections name their target with target_kind + target_id (20261103110000_contributions_inbox.sql). The
-- app stops writing the legacy target_ref column in the same release, so the check that demanded it for every
-- correction has to go first. This replaces it with the weaker rule "only a correction may carry a target_ref".
--
-- It only loosens one constraint; no column, row or other constraint changes:
-- * The app deployed before this one keeps writing target_ref on corrections and null on everything else,
--   which the new rule allows, so migrating first is safe and so is rolling the app back afterwards.
-- * The format check heritage_submissions_target_ref_format_check stays for whatever still writes a value.
-- * Nothing is dropped. heritage_words.areas and heritage_submissions.target_ref are still there, and the
--   triggers that keep heritage_words.areas up to date still run, so an older app keeps working. Dropping them
--   is a separate, later migration (docs/database.md, "Pending contract migration") that needs this release
--   live and an agreed rollback window.

alter table public.heritage_submissions
  drop constraint heritage_submissions_correction_target_check;

alter table public.heritage_submissions
  add constraint heritage_submissions_correction_target_check check (
    type = 'correction' or target_ref is null
  );

comment on column public.heritage_submissions.target_ref is
  'Legacy atlas item id of a correction. Superseded by target_kind + target_id and no longer written; kept until the contract migration drops it.';
