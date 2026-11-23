create function public.delete_heritage_submission(p_id bigint, p_paths text[])
returns boolean
language plpgsql
set search_path = public
as $$
declare
  photo_paths text[];
begin
  perform s.id from public.heritage_submissions s where s.id = p_id for update;
  if not found then
    return false;
  end if;

  select coalesce(array_agg(p.path order by p.position), array[]::text[])
    into photo_paths
    from public.heritage_submission_photos p where p.submission_id = p_id;

  if photo_paths is distinct from p_paths then
    raise exception 'Submission photos changed' using errcode = '40001';
  end if;

  delete from public.heritage_submissions s where s.id = p_id;
  return true;
end;
$$;

revoke all on function public.delete_heritage_submission(bigint, text[]) from public, anon, authenticated;
grant execute on function public.delete_heritage_submission(bigint, text[]) to service_role;
