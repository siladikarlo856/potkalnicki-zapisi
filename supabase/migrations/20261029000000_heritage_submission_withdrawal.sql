-- Rejecting or deleting a submission withdraws every word created from it:
-- the word is deactivated (public API only serves active rows) and kept for admin re-review.
create function public.heritage_submission_withdraw() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' and (new.status <> 'rejected' or old.status = 'rejected') then
    return new;
  end if;
  update public.heritage_words w set
    active = false,
    entry = case when TG_OP = 'DELETE' then jsonb_set(w.entry, '{sources}', (
      select coalesce(jsonb_agg(case when s->>'kind' = 'contribution' then s - 'credit' else s end), '[]'::jsonb)
      from jsonb_array_elements(w.entry->'sources') s
    )) else w.entry end
  where w.submission_id = old.id and (w.active or TG_OP = 'DELETE');
  return case when TG_OP = 'DELETE' then old else new end;
end;
$$;
revoke all on function public.heritage_submission_withdraw() from public, anon, authenticated;
create trigger heritage_submission_withdraw_reject after update of status on public.heritage_submissions
  for each row execute function public.heritage_submission_withdraw();
create trigger heritage_submission_withdraw_delete before delete on public.heritage_submissions
  for each row execute function public.heritage_submission_withdraw();
