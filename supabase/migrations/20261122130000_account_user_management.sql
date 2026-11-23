-- P5: maintainer grants (pre-authorise, promote, revoke), pending match on sign-in, account list email.

alter table public.account_profiles
  add column if not exists email text check (email is null or char_length(btrim(email)) between 3 and 320);

alter table public.account_profiles
  add column if not exists email_normalized text generated always as (
    case when email is null then null else lower(btrim(email)) end
  ) stored;

comment on column public.account_profiles.email is
  'Last verified Google email; used for account search and maintainer grant reconciliation.';

create index if not exists account_profiles_email_normalized_idx
  on public.account_profiles (email_normalized)
  where email_normalized is not null;

create or replace function public.account_sync_signed_in(
  p_account_id uuid,
  p_email text,
  p_bootstrap_email text
) returns public.account_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_normalized_email text := lower(btrim(p_email));
  v_bootstrap text := nullif(lower(btrim(coalesce(p_bootstrap_email, ''))), '');
  v_role public.account_role;
  v_before public.account_role;
  v_pending_id uuid;
  v_granted public.account_role;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'account sync is server-only' using errcode = 'insufficient_privilege';
  end if;
  if v_normalized_email is null or char_length(v_normalized_email) < 3 then
    raise exception 'verified email required' using errcode = 'check_violation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('account_bootstrap_admin'));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_normalized_email, 5));

  insert into public.account_profiles (id, email)
  values (p_account_id, v_normalized_email)
  on conflict (id) do update set email = excluded.email;

  select role into v_role
  from public.account_profiles
  where id = p_account_id
  for update;

  if v_bootstrap is not null
     and v_normalized_email = v_bootstrap
     and not exists (
       select 1 from public.account_role_audit where action = 'bootstrap_admin'
     )
  then
    v_before := v_role;
    update public.account_profiles
    set role = 'admin'::public.account_role
    where id = p_account_id;
    insert into public.account_role_audit (
      action, target_account_id, target_email, role_before, role_after, details
    ) values (
      'bootstrap_admin',
      p_account_id,
      v_normalized_email,
      v_before,
      'admin'::public.account_role,
      '{}'::jsonb
    );
    v_role := 'admin'::public.account_role;
  end if;

  if v_role = 'none'::public.account_role then
    select id, granted_role into v_pending_id, v_granted
    from public.account_pending_emails
    where email_normalized = v_normalized_email
      and status = 'pending'::public.account_pending_email_status
    for update;

    if found then
      v_before := v_role;
      update public.account_profiles
      set role = v_granted
      where id = p_account_id;
      update public.account_pending_emails
      set status = 'consumed'::public.account_pending_email_status,
          matched_account_id = p_account_id,
          matched_at = pg_catalog.now()
      where id = v_pending_id;
      insert into public.account_role_audit (
        action, actor_id, target_account_id, target_email, pending_email_id, role_before, role_after, details
      ) values (
        'grant_maintainer',
        null,
        p_account_id,
        v_normalized_email,
        v_pending_id,
        v_before,
        v_granted,
        '{"source":"pending_sign_in"}'::jsonb
      );
      v_role := v_granted;
    end if;
  end if;

  return v_role;
end;
$$;

create function public.account_assert_social_admin(p_actor_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.account_role;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'account management is server-only' using errcode = 'insufficient_privilege';
  end if;
  if p_actor_id is null then
    raise exception 'actor required' using errcode = 'check_violation';
  end if;
  select role into v_role from public.account_profiles where id = p_actor_id;
  if v_role is distinct from 'admin'::public.account_role then
    raise exception 'social admin role required' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

create function public.account_admin_preauthorize_maintainer(
  p_actor_id uuid,
  p_email text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_normalized text := lower(btrim(p_email));
  v_id uuid;
begin
  perform public.account_assert_social_admin(p_actor_id);
  if v_normalized is null or char_length(v_normalized) < 3 then
    raise exception 'email required' using errcode = 'check_violation';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_normalized, 5));
  if exists (
    select 1 from public.account_pending_emails
    where email_normalized = v_normalized
      and status = 'pending'::public.account_pending_email_status
  ) then
    raise exception 'pending email already exists' using errcode = 'unique_violation';
  end if;
  insert into public.account_pending_emails (email, granted_role, created_by)
  values (btrim(p_email), 'maintainer'::public.account_role, p_actor_id)
  returning id into v_id;
  insert into public.account_role_audit (
    action, actor_id, target_email, pending_email_id, role_before, role_after, details
  ) values (
    'grant_maintainer',
    p_actor_id,
    v_normalized,
    v_id,
    'none'::public.account_role,
    'maintainer'::public.account_role,
    '{"source":"preauthorize"}'::jsonb
  );
  return v_id;
end;
$$;

create function public.account_admin_cancel_pending(
  p_actor_id uuid,
  p_pending_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.account_pending_emails%rowtype;
begin
  perform public.account_assert_social_admin(p_actor_id);
  select * into v_row
  from public.account_pending_emails
  where id = p_pending_id
  for update;
  if not found then
    raise exception 'pending email not found' using errcode = 'no_data_found';
  end if;
  if v_row.status is distinct from 'pending'::public.account_pending_email_status then
    raise exception 'pending email is not open' using errcode = 'check_violation';
  end if;
  update public.account_pending_emails
  set status = 'cancelled'::public.account_pending_email_status,
      cancelled_by = p_actor_id,
      cancelled_at = pg_catalog.now()
  where id = p_pending_id;
  insert into public.account_role_audit (
    action, actor_id, target_email, pending_email_id, role_before, role_after, details
  ) values (
    'cancel_pending',
    p_actor_id,
    v_row.email_normalized,
    p_pending_id,
    'maintainer'::public.account_role,
    'none'::public.account_role,
  '{}'::jsonb
  );
end;
$$;

create function public.account_admin_promote_maintainer(
  p_actor_id uuid,
  p_target_id uuid,
  p_email text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.account_role;
  v_email text := lower(btrim(p_email));
  v_pending_id uuid;
begin
  perform public.account_assert_social_admin(p_actor_id);
  if p_target_id is null then
    raise exception 'target required' using errcode = 'check_violation';
  end if;
  if v_email is null or char_length(v_email) < 3 then
    raise exception 'verified email required' using errcode = 'check_violation';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 5));
  select role into v_before
  from public.account_profiles
  where id = p_target_id
  for update;
  if not found then
    raise exception 'account not found' using errcode = 'no_data_found';
  end if;
  if v_before is distinct from 'none'::public.account_role then
    raise exception 'only role-less accounts can be promoted' using errcode = 'check_violation';
  end if;
  update public.account_profiles
  set role = 'maintainer'::public.account_role, email = v_email
  where id = p_target_id;
  update public.account_pending_emails
  set status = 'consumed'::public.account_pending_email_status,
      matched_account_id = p_target_id,
      matched_at = pg_catalog.now()
  where email_normalized = v_email
    and status = 'pending'::public.account_pending_email_status
  returning id into v_pending_id;
  insert into public.account_role_audit (
    action, actor_id, target_account_id, target_email, pending_email_id, role_before, role_after, details
  ) values (
    'grant_maintainer',
    p_actor_id,
    p_target_id,
    v_email,
    v_pending_id,
    v_before,
    'maintainer'::public.account_role,
    '{"source":"promote"}'::jsonb
  );
end;
$$;

create function public.account_admin_revoke_maintainer(
  p_actor_id uuid,
  p_target_id uuid,
  p_email text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.account_role;
  v_email text := lower(btrim(p_email));
  v_pending_id uuid;
begin
  perform public.account_assert_social_admin(p_actor_id);
  if p_target_id is null then
    raise exception 'target required' using errcode = 'check_violation';
  end if;
  if p_actor_id = p_target_id then
    raise exception 'admin cannot revoke themself' using errcode = 'check_violation';
  end if;
  if v_email is null or char_length(v_email) < 3 then
    raise exception 'verified email required' using errcode = 'check_violation';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 5));
  select role into v_before
  from public.account_profiles
  where id = p_target_id
  for update;
  if not found then
    raise exception 'account not found' using errcode = 'no_data_found';
  end if;
  if v_before is distinct from 'maintainer'::public.account_role then
    raise exception 'only maintainers can be revoked' using errcode = 'check_violation';
  end if;
  update public.account_profiles
  set role = 'none'::public.account_role, email = v_email
  where id = p_target_id;
  select id into v_pending_id
  from public.account_pending_emails
  where email_normalized = v_email
    and status = 'pending'::public.account_pending_email_status
  for update;
  if found then
    perform public.account_admin_cancel_pending(p_actor_id, v_pending_id);
  end if;
  insert into public.account_role_audit (
    action, actor_id, target_account_id, target_email, role_before, role_after, details
  ) values (
    'revoke_role',
    p_actor_id,
    p_target_id,
    v_email,
    v_before,
    'none'::public.account_role,
    '{}'::jsonb
  );
end;
$$;

comment on function public.account_admin_preauthorize_maintainer(uuid, text) is
  'Creates a maintainer pre-authorisation row and audit event (social admin only).';
comment on function public.account_admin_cancel_pending(uuid, uuid) is
  'Cancels an open pending email before match (social admin only).';
comment on function public.account_admin_promote_maintainer(uuid, uuid, text) is
  'Promotes a registered role-less account to maintainer (social admin only).';
comment on function public.account_admin_revoke_maintainer(uuid, uuid, text) is
  'Revokes maintainer from a target account (social admin only; actor cannot be target).';

revoke all on function public.account_assert_social_admin(uuid) from public, anon, authenticated;
grant execute on function public.account_assert_social_admin(uuid) to service_role;

revoke all on function public.account_admin_preauthorize_maintainer(uuid, text),
  public.account_admin_cancel_pending(uuid, uuid),
  public.account_admin_promote_maintainer(uuid, uuid, text),
  public.account_admin_revoke_maintainer(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.account_admin_preauthorize_maintainer(uuid, text),
  public.account_admin_cancel_pending(uuid, uuid),
  public.account_admin_promote_maintainer(uuid, uuid, text),
  public.account_admin_revoke_maintainer(uuid, uuid, text)
  to service_role;
