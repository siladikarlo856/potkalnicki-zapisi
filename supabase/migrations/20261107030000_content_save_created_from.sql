-- A Draft made from a Proposal is saved through its kind's save function like any other create, so the save
-- functions now take source_submission_id on a create: the link to the Proposal that publishing the Draft
-- applies (content_apply_submission). The inbox used to insert these Drafts into the main table directly,
-- skipping the kind's validation and, for a person, its places. An update leaves the column as it is; the API
-- only sets it on a create, never from a client. Same signatures and grants; otherwise as in
-- 20261107020000_content_restore.sql.

create or replace function public.content_person_save(
  p_id uuid, p_revision integer, p_row jsonb, p_area_links jsonb, p_item_links jsonb, p_source_ids jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.persons := jsonb_populate_record(null::public.persons, p_row);
  saved uuid := coalesce(p_id, r.id, gen_random_uuid());
begin
  perform set_config('app.revision_sidecars', jsonb_build_object('id', saved, 'sidecars', jsonb_build_object(
    'areaLinks', coalesce(p_area_links, '[]'), 'itemLinks', coalesce(p_item_links, '[]'), 'sourceIds', coalesce(p_source_ids, '[]')
  ))::text, true);
  if p_id is null then
    insert into public.persons (
      id, revision, created_at,
      name, slug, role, clue, bio, born, born_year, born_place, died, died_year, died_place,
      open_questions, research_notes, verification, noindex, status, apply_submission_id, apply_credit, source_submission_id
    ) values (
      saved, coalesce(r.revision, 1), coalesce(r.created_at, now()),
      r.name, r.slug, r.role, r.clue, r.bio, r.born, r.born_year, r.born_place, r.died, r.died_year, r.died_place,
      r.open_questions, r.research_notes, r.verification, r.noindex, r.status, r.apply_submission_id, r.apply_credit, r.source_submission_id
    );
  else
    update public.persons set
      name = r.name, slug = r.slug, role = r.role, clue = r.clue, bio = r.bio, born = r.born, born_year = r.born_year,
      born_place = r.born_place, died = r.died, died_year = r.died_year, died_place = r.died_place,
      open_questions = r.open_questions, research_notes = r.research_notes, verification = r.verification,
      noindex = r.noindex, status = r.status, apply_submission_id = r.apply_submission_id, apply_credit = r.apply_credit
    where id = p_id and revision = p_revision;
    if not found then
      perform set_config('app.revision_sidecars', '', true);
      return null;
    end if;
  end if;

  delete from public.person_areas where person_id = saved;
  insert into public.person_areas (person_id, area_id, role, position)
  select saved, (link->>'areaId')::uuid, link->>'role', (n - 1)::smallint
  from jsonb_array_elements(coalesce(p_area_links, '[]')) with ordinality as t(link, n);

  delete from public.person_heritage_items where person_id = saved;
  insert into public.person_heritage_items (person_id, item_id, relation, position)
  select saved, (link->>'itemId')::uuid, link->>'relation', (n - 1)::smallint
  from jsonb_array_elements(coalesce(p_item_links, '[]')) with ordinality as t(link, n);

  delete from public.person_sources where person_id = saved;
  insert into public.person_sources (person_id, source_id, position)
  select saved, (source #>> '{}')::uuid, (n - 1)::smallint
  from jsonb_array_elements(coalesce(p_source_ids, '[]')) with ordinality as t(source, n);

  return saved;
end;
$$;

create or replace function public.content_area_save(p_id uuid, p_revision integer, p_row jsonb, p_region_ids jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.areas := jsonb_populate_record(null::public.areas, p_row);
  saved uuid := coalesce(p_id, r.id, gen_random_uuid());
begin
  perform set_config('app.revision_sidecars', jsonb_build_object('id', saved, 'sidecars', jsonb_build_object(
    'regionIds', coalesce(p_region_ids, '[]')
  ))::text, true);
  if p_id is null then
    insert into public.areas (
      id, revision, created_at,
      kind, parent_id, name, slug, official_code, geonames_id, latitude, longitude, description, status,
      apply_submission_id, apply_credit, source_submission_id
    ) values (
      saved, coalesce(r.revision, 1), coalesce(r.created_at, now()),
      r.kind, r.parent_id, r.name, r.slug, r.official_code, r.geonames_id, r.latitude, r.longitude, r.description, r.status,
      r.apply_submission_id, r.apply_credit, r.source_submission_id
    );
  else
    update public.areas set
      kind = r.kind, parent_id = r.parent_id, name = r.name, slug = r.slug, official_code = r.official_code,
      geonames_id = r.geonames_id, latitude = r.latitude, longitude = r.longitude, description = r.description,
      status = r.status, apply_submission_id = r.apply_submission_id, apply_credit = r.apply_credit
    where id = p_id and revision = p_revision;
    if not found then
      perform set_config('app.revision_sidecars', '', true);
      return null;
    end if;
  end if;

  delete from public.area_regions where area_id = saved;
  insert into public.area_regions (area_id, region_id)
  select saved, (region #>> '{}')::uuid
  from jsonb_array_elements(coalesce(p_region_ids, '[]')) as t(region);

  return saved;
end;
$$;

create or replace function public.content_club_save(
  p_id uuid, p_revision integer, p_row jsonb, p_seasons jsonb, p_source_ids jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.clubs := jsonb_populate_record(null::public.clubs, p_row);
  saved uuid := coalesce(p_id, r.id, gen_random_uuid());
begin
  perform set_config('app.revision_sidecars', jsonb_build_object('id', saved, 'sidecars', jsonb_build_object(
    'seasons', coalesce(p_seasons, '[]'), 'sourceIds', coalesce(p_source_ids, '[]')
  ))::text, true);
  if p_id is null then
    insert into public.clubs (
      id, revision, created_at,
      name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, noindex,
      status, apply_submission_id, apply_credit, source_submission_id
    ) values (
      saved, coalesce(r.revision, 1), coalesce(r.created_at, now()),
      r.name, r.slug, r.full_name, r.sport, r.settlement_id, r.founded_year, r.home_ground, r.research_notes,
      r.verification, r.noindex, r.status, r.apply_submission_id, r.apply_credit, r.source_submission_id
    );
  else
    update public.clubs set
      name = r.name, slug = r.slug, full_name = r.full_name, sport = r.sport, settlement_id = r.settlement_id,
      founded_year = r.founded_year, home_ground = r.home_ground, research_notes = r.research_notes,
      verification = r.verification, noindex = r.noindex, status = r.status,
      apply_submission_id = r.apply_submission_id, apply_credit = r.apply_credit
    where id = p_id and revision = p_revision;
    if not found then
      perform set_config('app.revision_sidecars', '', true);
      return null;
    end if;
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

create or replace function public.content_heritage_item_save(p_id uuid, p_revision integer, p_row jsonb, p_source_ids jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.heritage_items := jsonb_populate_record(null::public.heritage_items, p_row);
  saved uuid := coalesce(p_id, r.id, gen_random_uuid());
begin
  perform set_config('app.revision_sidecars', jsonb_build_object('id', saved, 'sidecars', jsonb_build_object(
    'sourceIds', coalesce(p_source_ids, '[]')
  ))::text, true);
  if p_id is null then
    insert into public.heritage_items (
      id, revision, created_at,
      name, slug, category_id, municipality_id, settlement_id, locality, verification, heritage_status,
      registry_number, period, description, research_notes, latitude, longitude, noindex, status,
      apply_submission_id, apply_credit, source_submission_id
    ) values (
      saved, coalesce(r.revision, 1), coalesce(r.created_at, now()),
      r.name, r.slug, r.category_id, r.municipality_id, r.settlement_id, r.locality, r.verification, r.heritage_status,
      r.registry_number, r.period, r.description, r.research_notes, r.latitude, r.longitude, r.noindex, r.status,
      r.apply_submission_id, r.apply_credit, r.source_submission_id
    );
  else
    update public.heritage_items set
      name = r.name, slug = r.slug, category_id = r.category_id, municipality_id = r.municipality_id,
      settlement_id = r.settlement_id, locality = r.locality, verification = r.verification,
      heritage_status = r.heritage_status, registry_number = r.registry_number, period = r.period,
      description = r.description, research_notes = r.research_notes, latitude = r.latitude, longitude = r.longitude,
      noindex = r.noindex, status = r.status, apply_submission_id = r.apply_submission_id, apply_credit = r.apply_credit
    where id = p_id and revision = p_revision;
    if not found then
      perform set_config('app.revision_sidecars', '', true);
      return null;
    end if;
  end if;

  delete from public.heritage_item_sources where item_id = saved;
  insert into public.heritage_item_sources (item_id, source_id, position)
  select saved, (source #>> '{}')::uuid, (n - 1)::smallint
  from jsonb_array_elements(coalesce(p_source_ids, '[]')) with ordinality as t(source, n);

  return saved;
end;
$$;
