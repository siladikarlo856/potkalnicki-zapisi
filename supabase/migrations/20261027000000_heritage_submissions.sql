-- Heritage submissions sent from the form on /heritage, reviewed on /review.
--
-- Row Level Security is on and nothing is readable through the public API:
--   * anon (the public key) may only INSERT a new pending submission with consent, and only
--     the form columns; it cannot read, update or delete anything;
--   * authenticated gets no access at all (the site has no user accounts);
--   * service_role (the server-only key used by the /review routes) bypasses RLS.

create table public.heritage_submissions (
  id bigint generated always as identity primary key,
  text text not null check (char_length(text) between 2 and 2000),
  type text check (type in ('word', 'expression', 'memory', 'other')),
  place text check (char_length(place) <= 120),
  name text check (char_length(name) <= 100),
  contact text check (char_length(contact) <= 200),
  consent_publish boolean not null check (consent_publish),
  consent_version text not null check (char_length(consent_version) <= 20),
  locale text not null check (locale in ('hr', 'en')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index heritage_submissions_status_created
  on public.heritage_submissions (status, created_at desc, id desc);

alter table public.heritage_submissions enable row level security;

-- Start from nothing, then grant only what the public form needs.
revoke all on table public.heritage_submissions from anon, authenticated, public;
grant insert (text, type, place, name, contact, consent_publish, consent_version, locale)
  on table public.heritage_submissions to anon;

create policy "anon can submit a pending submission with consent"
  on public.heritage_submissions
  for insert
  to anon
  with check (status = 'pending' and consent_publish and reviewed_at is null);
