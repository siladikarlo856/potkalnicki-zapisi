-- All app database access now uses the server-only secret key, which bypasses RLS.
-- Keep RLS and every check constraint; public keys must have no table access.
drop policy if exists "anon can submit a pending submission with consent"
  on public.heritage_submissions;

revoke all privileges on table public.heritage_submissions from anon, authenticated, public;
-- Table-level REVOKE does not remove the earlier column-level INSERT grant.
revoke all privileges (text, type, place, name, contact, consent_publish, consent_version, locale)
  on table public.heritage_submissions from anon, authenticated, public;
revoke all privileges on sequence public.heritage_submissions_id_seq from anon, authenticated, public;
