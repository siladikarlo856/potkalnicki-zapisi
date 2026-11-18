-- Keep the admin save RPC in step with the ordered actions stored on Customs.
create or replace function public.content_custom_save(
  p_id uuid, p_revision integer, p_row jsonb, p_area_links jsonb, p_narrators jsonb, p_author_ids jsonb, p_item_ids jsonb, p_theme_ids jsonb, p_source_ids jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.customs := jsonb_populate_record(null::public.customs, p_row);
  saved uuid := coalesce(p_id, r.id, gen_random_uuid());
begin
  perform set_config('app.revision_sidecars', jsonb_build_object('id', saved, 'sidecars', jsonb_build_object(
    'areaLinks', coalesce(p_area_links, '[]'), 'narrators', coalesce(p_narrators, '[]'), 'authorIds', coalesce(p_author_ids, '[]'),
    'itemIds', coalesce(p_item_ids, '[]'),
    'themeIds', coalesce(p_theme_ids, '[]'), 'sourceIds', coalesce(p_source_ids, '[]')
  ))::text, true);
  if p_id is null then
    insert into public.customs (
      id, revision, created_at,
      title, slug, type_id, occasion_id, description, quotes, steps, period, period_unit, period_value,
      recorded_precision, recorded_year, recorded_month, recorded_day,
      verification, research_notes, noindex, status, apply_submission_id, apply_credit, source_submission_id
    ) values (
      saved, coalesce(r.revision, 1), coalesce(r.created_at, now()),
      r.title, r.slug, r.type_id, r.occasion_id, r.description, r.quotes, r.steps, r.period, r.period_unit, r.period_value,
      r.recorded_precision, r.recorded_year, r.recorded_month, r.recorded_day,
      r.verification, r.research_notes, r.noindex, r.status, r.apply_submission_id, r.apply_credit, r.source_submission_id
    );
  else
    update public.customs set
      title = r.title, slug = r.slug, type_id = r.type_id, occasion_id = r.occasion_id, description = r.description,
      quotes = r.quotes, steps = r.steps, period = r.period, period_unit = r.period_unit, period_value = r.period_value,
      recorded_precision = r.recorded_precision, recorded_year = r.recorded_year, recorded_month = r.recorded_month,
      recorded_day = r.recorded_day, verification = r.verification, research_notes = r.research_notes, noindex = r.noindex,
      status = r.status, apply_submission_id = r.apply_submission_id, apply_credit = r.apply_credit
    where id = p_id and revision = p_revision;
    if not found then
      perform set_config('app.revision_sidecars', '', true);
      return null;
    end if;
  end if;

  perform public.content_intangible_links('custom', saved, p_area_links, p_narrators, p_author_ids, p_item_ids, p_theme_ids, p_source_ids, null);
  return saved;
end;
$$;

revoke all on function public.content_custom_save(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.content_custom_save(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
