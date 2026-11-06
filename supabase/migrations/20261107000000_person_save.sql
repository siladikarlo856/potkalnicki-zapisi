-- Save a person and its links (sources, places, heritage items) in one transaction. The admin API used to
-- write the persons row and then replace each link table with separate requests, so a failing link write
-- left a half-saved person. Additive: nothing else changes, and the old writes keep working.
--
-- p_id null creates a person; otherwise the row is updated only while it is still at p_revision.
-- p_row holds the persons columns (as the API maps them, plus the transient apply_submission_id and
-- apply_credit that content_apply_submission reads). The links are JSON arrays in the API's shape, saved in
-- their given order. Returns the saved id, or null when the row is gone or no longer at p_revision.
-- Every rule is checked by the API before this runs; the constraints and triggers still guard the data.

create function public.content_person_save(
  p_id uuid, p_revision integer, p_row jsonb, p_area_links jsonb, p_item_links jsonb, p_source_ids jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.persons := jsonb_populate_record(null::public.persons, p_row);
  saved uuid;
begin
  if p_id is null then
    insert into public.persons (
      name, slug, role, clue, bio, born, born_year, born_place, died, died_year, died_place,
      open_questions, research_notes, verification, noindex, status, apply_submission_id, apply_credit
    ) values (
      r.name, r.slug, r.role, r.clue, r.bio, r.born, r.born_year, r.born_place, r.died, r.died_year, r.died_place,
      r.open_questions, r.research_notes, r.verification, r.noindex, r.status, r.apply_submission_id, r.apply_credit
    ) returning id into saved;
  else
    update public.persons set
      name = r.name, slug = r.slug, role = r.role, clue = r.clue, bio = r.bio, born = r.born, born_year = r.born_year,
      born_place = r.born_place, died = r.died, died_year = r.died_year, died_place = r.died_place,
      open_questions = r.open_questions, research_notes = r.research_notes, verification = r.verification,
      noindex = r.noindex, status = r.status, apply_submission_id = r.apply_submission_id, apply_credit = r.apply_credit
    where id = p_id and revision = p_revision
    returning id into saved;
    if saved is null then return null; end if;
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

revoke all on function public.content_person_save(uuid, integer, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.content_person_save(uuid, integer, jsonb, jsonb, jsonb, jsonb) to service_role;
