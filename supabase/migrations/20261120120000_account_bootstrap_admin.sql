-- One-time first-admin bootstrap: server-only sync after a verified provider sign-in.

create unique index account_role_audit_single_bootstrap
  on public.account_role_audit ((1))
  where action = 'bootstrap_admin';

comment on index public.account_role_audit_single_bootstrap is
  'At most one bootstrap_admin audit row; the bootstrap grant cannot run twice.';

create function public.account_sync_signed_in(
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
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'account sync is server-only' using errcode = 'insufficient_privilege';
  end if;
  if v_normalized_email is null or char_length(v_normalized_email) < 3 then
    raise exception 'verified email required' using errcode = 'check_violation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('account_bootstrap_admin'));

  insert into public.account_profiles (id)
  values (p_account_id)
  on conflict (id) do nothing;

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

  return v_role;
end;
$$;

comment on function public.account_sync_signed_in(uuid, text, text) is
  'Ensures an account profile exists and grants admin once when p_email matches the configured bootstrap email.';

revoke all on function public.account_sync_signed_in(uuid, text, text) from public, anon, authenticated;
grant execute on function public.account_sync_signed_in(uuid, text, text) to service_role;
