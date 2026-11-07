-- Save an area, a club and a heritage item together with their sidecar tables in one transaction, as
-- content_person_save (20261107000000_person_save.sql) does for persons. The admin API used to write the
-- main row and then replace each sidecar table with separate requests, so a failing sidecar write left a
-- half-saved row. Additive: nothing else changes.
--
-- p_id null creates the row; otherwise it is updated only while it is still at p_revision. p_row holds the
-- main-table columns (as the API maps them, plus the transient apply_submission_id and apply_credit that
-- content_apply_submission reads). Sidecars are JSON arrays in the API's shape, saved in their given order.
-- Each returns the saved id, or null when the row is gone or no longer at p_revision.
-- Every rule is checked by the API before this runs; the constraints and triggers still guard the data.

create function public.content_area_save(p_id uuid, p_revision integer, p_row jsonb, p_region_ids jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.areas := jsonb_populate_record(null::public.areas, p_row);
  saved uuid;
begin
  if p_id is null then
    insert into public.areas (
      kind, parent_id, name, slug, official_code, geonames_id, latitude, longitude, description, status,
      apply_submission_id, apply_credit
    ) values (
      r.kind, r.parent_id, r.name, r.slug, r.official_code, r.geonames_id, r.latitude, r.longitude, r.description, r.status,
      r.apply_submission_id, r.apply_credit
    ) returning id into saved;
  else
    update public.areas set
      kind = r.kind, parent_id = r.parent_id, name = r.name, slug = r.slug, official_code = r.official_code,
      geonames_id = r.geonames_id, latitude = r.latitude, longitude = r.longitude, description = r.description,
      status = r.status, apply_submission_id = r.apply_submission_id, apply_credit = r.apply_credit
    where id = p_id and revision = p_revision
    returning id into saved;
    if saved is null then return null; end if;
  end if;

  delete from public.area_regions where area_id = saved;
  insert into public.area_regions (area_id, region_id)
  select saved, (region #>> '{}')::uuid
  from jsonb_array_elements(coalesce(p_region_ids, '[]')) as t(region);

  return saved;
end;
$$;

create function public.content_club_save(
  p_id uuid, p_revision integer, p_row jsonb, p_seasons jsonb, p_source_ids jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.clubs := jsonb_populate_record(null::public.clubs, p_row);
  saved uuid;
begin
  if p_id is null then
    insert into public.clubs (
      name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, noindex,
      status, apply_submission_id, apply_credit
    ) values (
      r.name, r.slug, r.full_name, r.sport, r.settlement_id, r.founded_year, r.home_ground, r.research_notes,
      r.verification, r.noindex, r.status, r.apply_submission_id, r.apply_credit
    ) returning id into saved;
  else
    update public.clubs set
      name = r.name, slug = r.slug, full_name = r.full_name, sport = r.sport, settlement_id = r.settlement_id,
      founded_year = r.founded_year, home_ground = r.home_ground, research_notes = r.research_notes,
      verification = r.verification, noindex = r.noindex, status = r.status,
      apply_submission_id = r.apply_submission_id, apply_credit = r.apply_credit
    where id = p_id and revision = p_revision
    returning id into saved;
    if saved is null then return null; end if;
  end if;

  delete from public.club_seasons where club_id = saved;
  insert into public.club_seasons (club_id, season, competition, team, source_url, checked_at)
  select saved, s->>'season', s->>'competition', s->>'team', s->>'sourceUrl', (s->>'checkedAt')::date
  from jsonb_array_elements(coalesce(p_seasons, '[]')) as t(s);

  delete from public.club_sources where club_id = saved;
  insert into public.club_sources (club_id, source_id, position)
  select saved, (source #>> '{}')::uuid, (n - 1)::smallint
  from jsonb_array_elements(coalesce(p_source_ids, '[]')) with ordinality as t(source, n);

  return saved;
end;
$$;

create function public.content_heritage_item_save(p_id uuid, p_revision integer, p_row jsonb, p_source_ids jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.heritage_items := jsonb_populate_record(null::public.heritage_items, p_row);
  saved uuid;
begin
  if p_id is null then
    insert into public.heritage_items (
      name, slug, category_id, municipality_id, settlement_id, locality, verification, heritage_status,
      registry_number, period, description, research_notes, latitude, longitude, noindex, status,
      apply_submission_id, apply_credit
    ) values (
      r.name, r.slug, r.category_id, r.municipality_id, r.settlement_id, r.locality, r.verification, r.heritage_status,
      r.registry_number, r.period, r.description, r.research_notes, r.latitude, r.longitude, r.noindex, r.status,
      r.apply_submission_id, r.apply_credit
    ) returning id into saved;
  else
    update public.heritage_items set
      name = r.name, slug = r.slug, category_id = r.category_id, municipality_id = r.municipality_id,
      settlement_id = r.settlement_id, locality = r.locality, verification = r.verification,
      heritage_status = r.heritage_status, registry_number = r.registry_number, period = r.period,
      description = r.description, research_notes = r.research_notes, latitude = r.latitude, longitude = r.longitude,
      noindex = r.noindex, status = r.status, apply_submission_id = r.apply_submission_id, apply_credit = r.apply_credit
    where id = p_id and revision = p_revision
    returning id into saved;
    if saved is null then return null; end if;
  end if;

  delete from public.heritage_item_sources where item_id = saved;
  insert into public.heritage_item_sources (item_id, source_id, position)
  select saved, (source #>> '{}')::uuid, (n - 1)::smallint
  from jsonb_array_elements(coalesce(p_source_ids, '[]')) with ordinality as t(source, n);

  return saved;
end;
$$;

revoke all on function public.content_area_save(uuid, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.content_area_save(uuid, integer, jsonb, jsonb) to service_role;
revoke all on function public.content_club_save(uuid, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.content_club_save(uuid, integer, jsonb, jsonb, jsonb) to service_role;
revoke all on function public.content_heritage_item_save(uuid, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.content_heritage_item_save(uuid, integer, jsonb, jsonb) to service_role;
