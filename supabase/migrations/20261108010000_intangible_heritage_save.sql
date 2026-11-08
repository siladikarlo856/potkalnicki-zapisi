-- Save a Story, a Custom or a Folk text together with their link tables in one transaction, and record those links
-- in the change history, exactly as content_person_save and its siblings do for persons, places, clubs and heritage
-- items (20261107000000_content_save.sql). Additive: new functions only; content_audit is unchanged.
--
-- content_story_save, content_custom_save and content_folk_text_save:
-- * p_id null creates the row; otherwise it is updated only while it is still at p_revision. Each returns the saved
--   id, or null when the row is gone or no longer at p_revision.
-- * p_row holds the main-table columns as the API maps them (plus the transient apply_submission_id / apply_credit).
--   On a create it may also carry id, revision and created_at (a restore recreates a deleted row under its old id and
--   creation time) and source_submission_id (a Draft made from a Memory). An update leaves those columns as they are.
-- * The links are JSON arrays in the API's shape, saved in their given order: p_area_links
--   [{areaId, relation: recorded_in | about}], p_people [{role, personId, consentNamed, consentNote, description}],
--   p_item_ids, p_theme_ids, p_source_ids (UUIDs) and, for a Folk text, p_word_ids (heritage_words ids, text).
-- * The links are recorded on the revision of the write as data->'sidecars' (areaLinks, people, itemIds, themeIds,
--   sourceIds, wordIds), handed to content_audit through app.revision_sidecars, so a restore brings them back.
-- Every rule is checked by the API before these run; the constraints and triggers still guard the data.

-- Replaces the link rows of one record. The prefix picks the kind's tables; it is checked against the three
-- kinds, so the dynamic SQL below only ever names their tables.
create function public.content_intangible_links(
  p_prefix text, p_id uuid, p_area_links jsonb, p_people jsonb, p_item_ids jsonb, p_theme_ids jsonb, p_source_ids jsonb, p_word_ids jsonb
) returns void
language plpgsql set search_path = '' as $$
declare
  fk text := p_prefix || '_id';
begin
  if p_prefix not in ('story', 'custom', 'folk_text') then
    raise exception 'Unknown intangible heritage kind %', p_prefix;
  end if;

  execute format('delete from public.%I where %I = $1', p_prefix || '_areas', fk) using p_id;
  execute format(
    'insert into public.%I (%I, area_id, relation, position) select $1, (l->>''areaId'')::uuid, l->>''relation'', (n - 1)::smallint '
    || 'from jsonb_array_elements($2) with ordinality as t(l, n)', p_prefix || '_areas', fk
  ) using p_id, coalesce(p_area_links, '[]');

  execute format('delete from public.%I where %I = $1', p_prefix || '_people', fk) using p_id;
  execute format(
    'insert into public.%I (%I, position, role, person_id, consent_named, consent_note, description) '
    || 'select $1, (n - 1)::smallint, l->>''role'', nullif(l->>''personId'', '''')::uuid, coalesce((l->>''consentNamed'')::boolean, false), '
    || 'nullif(l->>''consentNote'', ''''), nullif(l->>''description'', '''') from jsonb_array_elements($2) with ordinality as t(l, n)',
    p_prefix || '_people', fk
  ) using p_id, coalesce(p_people, '[]');

  execute format('delete from public.%I where %I = $1', p_prefix || '_heritage_items', fk) using p_id;
  execute format(
    'insert into public.%I (%I, item_id, position) select $1, (v #>> ''{}'')::uuid, (n - 1)::smallint from jsonb_array_elements($2) with ordinality as t(v, n)',
    p_prefix || '_heritage_items', fk
  ) using p_id, coalesce(p_item_ids, '[]');

  execute format('delete from public.%I where %I = $1', p_prefix || '_themes', fk) using p_id;
  execute format(
    'insert into public.%I (%I, theme_id, position) select $1, (v #>> ''{}'')::uuid, (n - 1)::smallint from jsonb_array_elements($2) with ordinality as t(v, n)',
    p_prefix || '_themes', fk
  ) using p_id, coalesce(p_theme_ids, '[]');

  execute format('delete from public.%I where %I = $1', p_prefix || '_sources', fk) using p_id;
  execute format(
    'insert into public.%I (%I, source_id, position) select $1, (v #>> ''{}'')::uuid, (n - 1)::smallint from jsonb_array_elements($2) with ordinality as t(v, n)',
    p_prefix || '_sources', fk
  ) using p_id, coalesce(p_source_ids, '[]');

  if p_prefix = 'folk_text' then
    delete from public.folk_text_words where folk_text_id = p_id;
    insert into public.folk_text_words (folk_text_id, word_id, position)
    select p_id, v #>> '{}', (n - 1)::smallint from jsonb_array_elements(coalesce(p_word_ids, '[]')) with ordinality as t(v, n);
  end if;
end;
$$;

create function public.content_story_save(
  p_id uuid, p_revision integer, p_row jsonb, p_area_links jsonb, p_people jsonb, p_item_ids jsonb, p_theme_ids jsonb, p_source_ids jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.stories := jsonb_populate_record(null::public.stories, p_row);
  saved uuid := coalesce(p_id, r.id, gen_random_uuid());
begin
  perform set_config('app.revision_sidecars', jsonb_build_object('id', saved, 'sidecars', jsonb_build_object(
    'areaLinks', coalesce(p_area_links, '[]'), 'people', coalesce(p_people, '[]'), 'itemIds', coalesce(p_item_ids, '[]'),
    'themeIds', coalesce(p_theme_ids, '[]'), 'sourceIds', coalesce(p_source_ids, '[]')
  ))::text, true);
  if p_id is null then
    insert into public.stories (
      id, revision, created_at,
      title, slug, type_id, text_local, text_standard, period, period_unit, period_value,
      recorded_precision, recorded_year, recorded_month, recorded_day,
      verification, research_notes, noindex, status, apply_submission_id, apply_credit, source_submission_id
    ) values (
      saved, coalesce(r.revision, 1), coalesce(r.created_at, now()),
      r.title, r.slug, r.type_id, r.text_local, r.text_standard, r.period, r.period_unit, r.period_value,
      r.recorded_precision, r.recorded_year, r.recorded_month, r.recorded_day,
      r.verification, r.research_notes, r.noindex, r.status, r.apply_submission_id, r.apply_credit, r.source_submission_id
    );
  else
    update public.stories set
      title = r.title, slug = r.slug, type_id = r.type_id, text_local = r.text_local, text_standard = r.text_standard,
      period = r.period, period_unit = r.period_unit, period_value = r.period_value,
      recorded_precision = r.recorded_precision, recorded_year = r.recorded_year, recorded_month = r.recorded_month,
      recorded_day = r.recorded_day, verification = r.verification, research_notes = r.research_notes, noindex = r.noindex,
      status = r.status, apply_submission_id = r.apply_submission_id, apply_credit = r.apply_credit
    where id = p_id and revision = p_revision;
    if not found then
      perform set_config('app.revision_sidecars', '', true);
      return null;
    end if;
  end if;

  perform public.content_intangible_links('story', saved, p_area_links, p_people, p_item_ids, p_theme_ids, p_source_ids, null);
  return saved;
end;
$$;

create function public.content_custom_save(
  p_id uuid, p_revision integer, p_row jsonb, p_area_links jsonb, p_people jsonb, p_item_ids jsonb, p_theme_ids jsonb, p_source_ids jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.customs := jsonb_populate_record(null::public.customs, p_row);
  saved uuid := coalesce(p_id, r.id, gen_random_uuid());
begin
  perform set_config('app.revision_sidecars', jsonb_build_object('id', saved, 'sidecars', jsonb_build_object(
    'areaLinks', coalesce(p_area_links, '[]'), 'people', coalesce(p_people, '[]'), 'itemIds', coalesce(p_item_ids, '[]'),
    'themeIds', coalesce(p_theme_ids, '[]'), 'sourceIds', coalesce(p_source_ids, '[]')
  ))::text, true);
  if p_id is null then
    insert into public.customs (
      id, revision, created_at,
      title, slug, type_id, occasion_id, description, quotes, period, period_unit, period_value,
      recorded_precision, recorded_year, recorded_month, recorded_day,
      verification, research_notes, noindex, status, apply_submission_id, apply_credit, source_submission_id
    ) values (
      saved, coalesce(r.revision, 1), coalesce(r.created_at, now()),
      r.title, r.slug, r.type_id, r.occasion_id, r.description, r.quotes, r.period, r.period_unit, r.period_value,
      r.recorded_precision, r.recorded_year, r.recorded_month, r.recorded_day,
      r.verification, r.research_notes, r.noindex, r.status, r.apply_submission_id, r.apply_credit, r.source_submission_id
    );
  else
    update public.customs set
      title = r.title, slug = r.slug, type_id = r.type_id, occasion_id = r.occasion_id, description = r.description,
      quotes = r.quotes, period = r.period, period_unit = r.period_unit, period_value = r.period_value,
      recorded_precision = r.recorded_precision, recorded_year = r.recorded_year, recorded_month = r.recorded_month,
      recorded_day = r.recorded_day, verification = r.verification, research_notes = r.research_notes, noindex = r.noindex,
      status = r.status, apply_submission_id = r.apply_submission_id, apply_credit = r.apply_credit
    where id = p_id and revision = p_revision;
    if not found then
      perform set_config('app.revision_sidecars', '', true);
      return null;
    end if;
  end if;

  perform public.content_intangible_links('custom', saved, p_area_links, p_people, p_item_ids, p_theme_ids, p_source_ids, null);
  return saved;
end;
$$;

create function public.content_folk_text_save(
  p_id uuid, p_revision integer, p_row jsonb, p_area_links jsonb, p_people jsonb, p_item_ids jsonb, p_theme_ids jsonb, p_source_ids jsonb,
  p_word_ids jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.folk_texts := jsonb_populate_record(null::public.folk_texts, p_row);
  saved uuid := coalesce(p_id, r.id, gen_random_uuid());
begin
  perform set_config('app.revision_sidecars', jsonb_build_object('id', saved, 'sidecars', jsonb_build_object(
    'areaLinks', coalesce(p_area_links, '[]'), 'people', coalesce(p_people, '[]'), 'itemIds', coalesce(p_item_ids, '[]'),
    'themeIds', coalesce(p_theme_ids, '[]'), 'sourceIds', coalesce(p_source_ids, '[]'), 'wordIds', coalesce(p_word_ids, '[]')
  ))::text, true);
  if p_id is null then
    insert into public.folk_texts (
      id, revision, created_at,
      title, slug, type_id, custom_id, text_local, text_standard,
      recorded_precision, recorded_year, recorded_month, recorded_day,
      verification, research_notes, noindex, status, apply_submission_id, apply_credit, source_submission_id
    ) values (
      saved, coalesce(r.revision, 1), coalesce(r.created_at, now()),
      r.title, r.slug, r.type_id, r.custom_id, r.text_local, r.text_standard,
      r.recorded_precision, r.recorded_year, r.recorded_month, r.recorded_day,
      r.verification, r.research_notes, r.noindex, r.status, r.apply_submission_id, r.apply_credit, r.source_submission_id
    );
  else
    update public.folk_texts set
      title = r.title, slug = r.slug, type_id = r.type_id, custom_id = r.custom_id, text_local = r.text_local,
      text_standard = r.text_standard, recorded_precision = r.recorded_precision, recorded_year = r.recorded_year,
      recorded_month = r.recorded_month, recorded_day = r.recorded_day, verification = r.verification,
      research_notes = r.research_notes, noindex = r.noindex, status = r.status,
      apply_submission_id = r.apply_submission_id, apply_credit = r.apply_credit
    where id = p_id and revision = p_revision;
    if not found then
      perform set_config('app.revision_sidecars', '', true);
      return null;
    end if;
  end if;

  perform public.content_intangible_links('folk_text', saved, p_area_links, p_people, p_item_ids, p_theme_ids, p_source_ids, p_word_ids);
  return saved;
end;
$$;

revoke all on function public.content_intangible_links(text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.content_intangible_links(text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
revoke all on function public.content_story_save(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.content_story_save(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
revoke all on function public.content_custom_save(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.content_custom_save(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
revoke all on function public.content_folk_text_save(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.content_folk_text_save(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
