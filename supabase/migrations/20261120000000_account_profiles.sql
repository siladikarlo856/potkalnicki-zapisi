-- Account metadata for social-auth users. Content remains server-only: these tables do not
-- grant authenticated users access to any existing editorial table.

create type public.account_role as enum ('none', 'maintainer', 'admin');
create type public.account_pending_email_status as enum ('pending', 'consumed', 'cancelled');

create function public.account_current_user_id() returns uuid
language sql stable set search_path = '' as $$
  select nullif(nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;

create table public.account_profiles (
  id uuid primary key,
  role public.account_role not null default 'none',
  main_place_id uuid references public.areas(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.account_profiles is
  'One profile per authenticated account. Role is server-managed; main_place_id is the signed-in player''s published Naselje preference.';
comment on column public.account_profiles.role is
  'Editorial role; only the server/service_role may change it.';
comment on column public.account_profiles.main_place_id is
  'Optional Glavno mjesto. Writes are accepted only for a published Naselje.';

-- A pending email is an authorization record, never an authentication credential. The generated
-- key makes matching case-insensitive while retaining the submitted address for later admin UI.
create table public.account_pending_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(btrim(email)) between 3 and 320),
  email_normalized text generated always as (lower(btrim(email))) stored,
  granted_role public.account_role not null default 'maintainer'
    check (granted_role in ('maintainer', 'admin')),
  status public.account_pending_email_status not null default 'pending',
  created_by uuid,
  created_at timestamptz not null default now(),
  matched_account_id uuid,
  matched_at timestamptz,
  cancelled_by uuid,
  cancelled_at timestamptz
);
comment on table public.account_pending_emails is
  'Server-only pre-authorisation records; an email here is not a login credential.';
comment on column public.account_pending_emails.email_normalized is
  'Lowercase, trimmed provider-email matching key.';
create unique index account_pending_emails_pending_key
  on public.account_pending_emails (email_normalized)
  where status = 'pending';

-- One audit row is retained for every future bootstrap, grant, cancellation and revocation.
-- UUIDs deliberately do not reference auth.users: Supabase Auth owns that schema and the audit
-- record must survive account deletion or provider changes.
create table public.account_role_audit (
  id bigint generated always as identity primary key,
  action text not null check (action in ('bootstrap_admin', 'grant_maintainer', 'cancel_pending', 'revoke_role')),
  actor_id uuid,
  target_account_id uuid,
  target_email text check (target_email is null or target_email = lower(btrim(target_email))),
  pending_email_id uuid references public.account_pending_emails(id) on delete set null,
  role_before public.account_role,
  role_after public.account_role,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  check (target_account_id is not null or target_email is not null)
);
comment on table public.account_role_audit is
  'Server-only append history for account role and maintainer pre-authorisation decisions.';

-- The server uses this function for protected-route checks. It is intentionally not callable by
-- browser roles, which must not turn this schema into a role-management API.
create function public.account_role_for_user(p_user_id uuid) returns public.account_role
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select role from public.account_profiles where id = p_user_id),
    'none'::public.account_role
  )
$$;

create function public.account_profiles_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- A browser may create its own role-less profile, but only service_role (or a direct
  -- migration/maintenance connection) may grant, revoke or bootstrap a role.
  if current_user not in ('postgres', 'service_role') then
    if tg_op = 'INSERT' and new.role <> 'none' then
      raise exception 'account role is server-managed' using errcode = 'insufficient_privilege';
    end if;
    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'account role is server-managed' using errcode = 'insufficient_privilege';
    end if;
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function public.account_profile_main_place_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.main_place_id is not null and not exists (
    select 1
    from public.areas
    where id = new.main_place_id
      and kind = 'settlement'
      and status = 'published'
  ) then
    raise exception 'main_place_id must reference a published Naselje' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger account_profiles_before_write
before insert or update on public.account_profiles
for each row execute function public.account_profiles_before_write();

create trigger account_profiles_main_place_check
before insert or update of main_place_id on public.account_profiles
for each row execute function public.account_profile_main_place_check();

alter table public.account_profiles enable row level security;
alter table public.account_pending_emails enable row level security;
alter table public.account_role_audit enable row level security;

-- A signed-in account can see only its own profile and can create/update only its own preference.
-- Role writes are additionally blocked by column grants and the before-write trigger.
create policy account_profiles_select_own
  on public.account_profiles for select to authenticated
  using (id = public.account_current_user_id());
create policy account_profiles_insert_own
  on public.account_profiles for insert to authenticated
  with check (id = public.account_current_user_id() and role = 'none');
create policy account_profiles_update_own
  on public.account_profiles for update to authenticated
  using (id = public.account_current_user_id())
  with check (id = public.account_current_user_id());

-- No policies or grants are created for pending email or audit tables. service_role bypasses RLS
-- and receives explicit access below; anon/authenticated remain unable to address these tables.
revoke all privileges on table public.account_pending_emails, public.account_role_audit
  from public, anon, authenticated;
grant all privileges on table public.account_pending_emails, public.account_role_audit to service_role;
grant usage on type public.account_role, public.account_pending_email_status to authenticated, service_role;

revoke all privileges on table public.account_profiles from public, anon, authenticated;
grant select on table public.account_profiles to authenticated;
grant insert (id, main_place_id) on table public.account_profiles to authenticated;
grant update (main_place_id) on table public.account_profiles to authenticated;
grant all privileges on table public.account_profiles to service_role;

revoke all on function public.account_role_for_user(uuid) from public, anon, authenticated;
grant execute on function public.account_role_for_user(uuid) to service_role;
grant execute on function public.account_current_user_id() to anon, authenticated, service_role;
revoke all on function public.account_profiles_before_write(), public.account_profile_main_place_check()
  from public, anon, authenticated;
grant execute on function public.account_profiles_before_write(), public.account_profile_main_place_check()
  to service_role;
