-- Save a person, an area, a club and a heritage item together with their sidecar tables in one transaction,
-- and record those sidecars in the change history. The admin API used to write the main row and then replace
-- each sidecar table with separate requests, so a failing sidecar write left a half-saved row, a history
-- restore was not atomic, and a revision held only the main row: a Published person or club (which needs a
-- source) could not be restored, because its sources were not in the stored version. Additive: new functions,
-- and content_audit keeps its signature and grants.
--
-- content_person_save, content_area_save, content_club_save and content_heritage_item_save:
-- * p_id null creates the row; otherwise it is updated only while it is still at p_revision. Each returns the
--   saved id, or null when the row is gone or no longer at p_revision.
-- * p_row holds the main-table columns (as the API maps them, plus the transient apply_submission_id and
--   apply_credit that content_apply_submission reads). Sidecars are JSON arrays in the API's shape, saved in
--   their given order.
-- * On a create, p_row may also carry id, revision and created_at (a restore recreates a deleted row under
--   its old id and creation time, continuing its revision count) and source_submission_id (a Draft made from
--   a Proposal links the Proposal that publishing the Draft applies). An update leaves those columns as they
--   are. The API never takes them from a client.
-- * Each records the sidecars it writes on the revision of that write, under data->'sidecars' in the API's
--   shape. It hands them to content_audit through the transaction setting app.revision_sidecars, as
--   content_apply_submission hands over app.submission_id, so content_revisions stays append-only. Writes
--   that do not go through these functions (an archive, a delete, a seed) record none; older revisions
--   simply have no 'sidecars' key.
-- Every rule is checked by the API before these run; the constraints and triggers still guard the data.

create or replace function public.content_audit() returns trigger language plpgsql set search_path = '' as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  pending text := nullif(current_setting('app.submission_id', true), '');
  sidecars jsonb := nullif(current_setting('app.revision_sidecars', true), '')::jsonb;
  applied bigint;
begin
  if pending is not null and split_part(pending, ':', 1) = rec->>'id' then
    applied := split_part(pending, ':', 2)::bigint;
    perform set_config('app.submission_id', '', true);
  end if;
  -- Set by a content_*_save function for exactly this row.
  if sidecars is not null and tg_op <> 'DELETE' and sidecars->>'id' = rec->>'id' then
    rec := rec || jsonb_build_object('sidecars', sidecars->'sidecars');
    perform set_config('app.revision_sidecars', '', true);
  end if;
  insert into public.content_revisions (entity_kind, entity_id, revision, action, data, submission_id, actor)
  values (tg_argv[0], (rec->>'id')::uuid,
    case when tg_op = 'DELETE' then old.revision + 1 else new.revision end,
    lower(tg_op), rec - 'search_text' - 'apply_submission_id' - 'apply_credit', applied,
    coalesce(nullif(current_setting('app.actor', true), ''), 'admin'));
  return null;
end;
$$;

create function public.content_person_save(
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

create function public.content_area_save(p_id uuid, p_revision integer, p_row jsonb, p_region_ids jsonb) returns uuid
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

create function public.content_club_save(
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

create function public.content_heritage_item_save(p_id uuid, p_revision integer, p_row jsonb, p_source_ids jsonb) returns uuid
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

revoke all on function public.content_person_save(uuid, integer, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.content_person_save(uuid, integer, jsonb, jsonb, jsonb, jsonb) to service_role;
revoke all on function public.content_area_save(uuid, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.content_area_save(uuid, integer, jsonb, jsonb) to service_role;
revoke all on function public.content_club_save(uuid, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.content_club_save(uuid, integer, jsonb, jsonb, jsonb) to service_role;
revoke all on function public.content_heritage_item_save(uuid, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.content_heritage_item_save(uuid, integer, jsonb, jsonb) to service_role;
