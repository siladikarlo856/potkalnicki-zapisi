-- Word areas from the areas table (PR 3b). Depends on 20261103010000_content_tables.sql (areas,
-- content_legacy_ids) and 20261103030000_word_admin_columns.sql (heritage_words_id_uuid,
-- heritage_words_before_write).
--
-- What it does:
-- 1. Creates heritage_word_areas: FK from words to areas, maintained by trigger from entry
--    usages/examples. area_id is RESTRICT (cannot delete an area a word uses); word_id is CASCADE
--    (deleting a word drops its usage links). Legacy string keys are resolved via content_legacy_ids.
-- 2. Backfills: rewrites legacy area keys in entry (variants[].usages[].areaId and examples[].areaId)
--    to UUIDs from content_legacy_ids, rebuilds the per-word areas JSONB column from the areas table
--    (full hierarchy for each referenced area), and populates heritage_word_areas.
-- 3. Rewrites heritage_daily_words.village, snapshot.villageAreaId and clue areaIds (with the guard
--    trigger disabled inside this migration; all currently unresolved so the guard is not reached).
-- 4. Dual-writes the areas column after every word write, projecting from the areas table. The column
--    is kept until PR 14; a rolled-back app still renders because the projected data is there.
-- 5. Updates the promotion lookup: the server will read from areas.geonames_id; no SQL change needed
--    here because the mapping was a server-side constant only (PLACE_AREA_IDS in words.ts).
--
-- Additive and backward-compatible: the previous app reads the areas column (which is now projected)
-- and writes entry with either UUIDs or legacy keys (both are handled by the trigger). A rollback
-- keeps the table, triggers and backfilled data.

-- 1. heritage_word_areas ------------------------------------------------------------------

create table public.heritage_word_areas (
  word_id text not null references public.heritage_words(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete restrict,
  primary key (word_id, area_id)
);
create index heritage_word_areas_area on public.heritage_word_areas (area_id);
comment on table public.heritage_word_areas is
  'Referential integrity: one row per (word, area) referenced by usages or examples. Maintained by trigger. '
  'Deleting an area a word uses is refused (restrict); deleting a word cascades here.';

alter table public.heritage_word_areas enable row level security;
revoke all privileges on table public.heritage_word_areas from public, anon, authenticated;
grant all privileges on table public.heritage_word_areas to service_role;

-- 2. Helpers -------------------------------------------------------------------------------

-- Resolve an area id string: try UUID directly, then content_legacy_ids.
-- Returns null for unknown values (so old admin writes with stale legacy keys never fail).
create function public.resolve_area_id(id_text text) returns uuid language plpgsql set search_path = '' as $$
declare
  result uuid;
begin
  -- Direct UUID parse
  begin
    result := id_text::uuid;
    if exists (select 1 from public.areas where id = result) then
      return result;
    end if;
    return null;
  exception when invalid_text_representation then null;
  end;
  -- Legacy key lookup
  select entity_id into result from public.content_legacy_ids where kind = 'area' and legacy_id = id_text;
  return result;
end;
$$;

-- Collect distinct, resolved area UUIDs from a word entry's usages and examples.
create function public.word_entry_area_ids(entry jsonb) returns uuid[] language sql set search_path = '' as $$
  select coalesce(array_agg(distinct a), '{}') from (
    select public.resolve_area_id(u->>'areaId') as a
    from jsonb_array_elements(
           case when jsonb_typeof(entry->'variants') = 'array' then entry->'variants' else '[]'::jsonb end) as v,
         jsonb_array_elements(
           case when jsonb_typeof(v->'usages') = 'array' then v->'usages' else '[]'::jsonb end) as u
    where jsonb_typeof(u->'areaId') = 'string'
    union all
    select public.resolve_area_id(e->>'areaId') as a
    from jsonb_array_elements(
           case when jsonb_typeof(entry->'examples') = 'array' then entry->'examples' else '[]'::jsonb end) as e
    where jsonb_typeof(e->'areaId') = 'string'
  ) sub
  where a is not null
$$;

-- Build the full ancestor hierarchy for a set of area UUIDs, returned as a JSONB array in the
-- public Area shape: { id, name, kind, parentId, externalIds? }. Used for the dual-written areas
-- column. Any area (from settlement up to country) that is an ancestor of any referenced area is
-- included exactly once.
create function public.areas_hierarchy_jsonb(area_ids uuid[]) returns jsonb language sql set search_path = '' as $$
  with recursive anc as (
    select id, kind, parent_id, name, official_code, geonames_id
    from public.areas
    where id = any(area_ids)
    union
    select a.id, a.kind, a.parent_id, a.name, a.official_code, a.geonames_id
    from public.areas a
    join anc on a.id = anc.parent_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', id::text,
        'name', name,
        'kind', kind,
        'parentId', parent_id::text,
        'externalIds', case
          when official_code is not null or geonames_id is not null then
            jsonb_strip_nulls(jsonb_build_object(
              'dgu', official_code,
              'geonames', geonames_id
            ))
          else null
        end
      ))
    ), '[]'::jsonb)
  from anc
$$;

-- Rewrite area id strings in a JSONB value at a fixed text path. Used for the backfill.
-- Walks arrays and objects to replace the exact key given by path_key.
create function public.rewrite_area_ids_in_jsonb(
  entry jsonb,
  legacy_map jsonb  -- text → text (legacy_id → uuid as text)
) returns jsonb language plpgsql set search_path = '' as $$
declare
  new_entry jsonb := entry;
  v_idx integer;
  u_idx integer;
  old_area_id text;
  new_area_id text;
  new_variants jsonb;
  new_usages jsonb;
  new_examples jsonb;
  variant jsonb;
  usage jsonb;
  example jsonb;
begin
  -- Rewrite variants[].usages[].areaId
  if jsonb_typeof(new_entry->'variants') = 'array' then
    new_variants := '[]'::jsonb;
    for v_idx in 0 .. jsonb_array_length(new_entry->'variants') - 1 loop
      variant := new_entry->'variants'->v_idx;
      if jsonb_typeof(variant->'usages') = 'array' then
        new_usages := '[]'::jsonb;
        for u_idx in 0 .. jsonb_array_length(variant->'usages') - 1 loop
          usage := variant->'usages'->u_idx;
          old_area_id := usage->>'areaId';
          new_area_id := legacy_map->>old_area_id;
          if new_area_id is not null then
            usage := jsonb_set(usage, '{areaId}', to_jsonb(new_area_id));
          end if;
          new_usages := new_usages || jsonb_build_array(usage);
        end loop;
        variant := jsonb_set(variant, '{usages}', new_usages);
      end if;
      new_variants := new_variants || jsonb_build_array(variant);
    end loop;
    new_entry := jsonb_set(new_entry, '{variants}', new_variants);
  end if;

  -- Rewrite examples[].areaId
  if jsonb_typeof(new_entry->'examples') = 'array' then
    new_examples := '[]'::jsonb;
    for v_idx in 0 .. jsonb_array_length(new_entry->'examples') - 1 loop
      example := new_entry->'examples'->v_idx;
      old_area_id := example->>'areaId';
      if old_area_id is not null then
        new_area_id := legacy_map->>old_area_id;
        if new_area_id is not null then
          example := jsonb_set(example, '{areaId}', to_jsonb(new_area_id));
        end if;
      end if;
      new_examples := new_examples || jsonb_build_array(example);
    end loop;
    new_entry := jsonb_set(new_entry, '{examples}', new_examples);
  end if;

  return new_entry;
end;
$$;

-- 3. Triggers: project the legacy areas column before writes and sync the link table after writes

-- Keep the old JSON projection in the same write that changes the entry. Updating the source row
-- from an AFTER trigger would fire this trigger again (and bump revision/history recursively).
create function public.heritage_word_areas_project() returns trigger language plpgsql set search_path = '' as $$
begin
  new.areas := public.areas_hierarchy_jsonb(public.word_entry_area_ids(new.entry));
  return new;
end;
$$;

create function public.heritage_word_areas_sync() returns trigger language plpgsql set search_path = '' as $$
declare
  area_uuids uuid[];
  area_uuid uuid;
begin
  -- Collect the distinct resolved area UUIDs from the new entry.
  area_uuids := public.word_entry_area_ids(new.entry);

  -- Sync heritage_word_areas: delete rows no longer referenced, insert new ones.
  delete from public.heritage_word_areas
  where word_id = new.id and not (area_id = any(area_uuids));

  foreach area_uuid in array area_uuids loop
    insert into public.heritage_word_areas (word_id, area_id) values (new.id, area_uuid)
    on conflict do nothing;
  end loop;

  return null;  -- AFTER trigger
end;
$$;

create trigger heritage_word_areas_project before insert or update on public.heritage_words
  for each row execute function public.heritage_word_areas_project();
create trigger heritage_word_areas_sync after insert or update on public.heritage_words
  for each row execute function public.heritage_word_areas_sync();

-- 4. Backfill ------------------------------------------------------------------------------

do $$
declare
  legacy_map jsonb := '{}';
  leg record;
  word record;
  new_entry jsonb;
  area_uuids uuid[];
  daily record;
  old_village text;
  new_village text;
  snap jsonb;
  new_snap jsonb;
  old_vid text;
  new_vid text;
  clue record;
  new_clues jsonb;
  clue_val jsonb;
  c_idx integer;
  old_aid text;
  new_aid text;
  new_area_ids jsonb;
  aid_idx integer;
begin
  -- Build legacy_id → uuid-as-text map from content_legacy_ids (all area kind rows).
  for leg in select legacy_id, entity_id from public.content_legacy_ids where kind = 'area' loop
    legacy_map := legacy_map || jsonb_build_object(leg.legacy_id, leg.entity_id::text);
  end loop;

  -- Disable the guard trigger on daily words so we can rewrite snapshots that have legacy ids.
  alter table public.heritage_daily_words disable trigger heritage_daily_word_guard;

  -- Rewrite heritage_daily_words.village (holds an area id or 'auto'/'none').
  for daily in select day, village, snapshot from public.heritage_daily_words loop
    old_village := daily.village;
    new_village := coalesce(legacy_map->>old_village, old_village);
    snap := daily.snapshot;
    new_snap := snap;
    -- Rewrite snapshot.villageAreaId
    if snap is not null and jsonb_typeof(snap->'villageAreaId') = 'string' then
      old_vid := snap->>'villageAreaId';
      new_vid := coalesce(legacy_map->>old_vid, old_vid);
      new_snap := jsonb_set(new_snap, '{villageAreaId}', to_jsonb(new_vid));
    end if;
    -- Rewrite area ids inside snapshot.clues[].areaIds
    if snap is not null and jsonb_typeof(snap->'clues') = 'array' then
      new_clues := '[]'::jsonb;
      for c_idx in 0 .. jsonb_array_length(snap->'clues') - 1 loop
        clue_val := snap->'clues'->c_idx;
        if jsonb_typeof(clue_val->'areaIds') = 'array' then
          new_area_ids := '[]'::jsonb;
          for aid_idx in 0 .. jsonb_array_length(clue_val->'areaIds') - 1 loop
            old_aid := clue_val->'areaIds'->>aid_idx;
            new_aid := coalesce(legacy_map->>old_aid, old_aid);
            new_area_ids := new_area_ids || to_jsonb(new_aid);
          end loop;
          clue_val := jsonb_set(clue_val, '{areaIds}', new_area_ids);
        end if;
        new_clues := new_clues || jsonb_build_array(clue_val);
      end loop;
      new_snap := jsonb_set(new_snap, '{clues}', new_clues);
    end if;
    if new_village is distinct from old_village or new_snap is distinct from snap then
      update public.heritage_daily_words
      set village = new_village, snapshot = new_snap
      where day = daily.day;
    end if;
  end loop;

  alter table public.heritage_daily_words enable trigger heritage_daily_word_guard;

  -- Rewrite word entries and rebuild the projection without recording an editorial revision. This is
  -- migration normalization, not an admin edit, so pause the word write/audit triggers and populate
  -- the link table explicitly below.
  alter table public.heritage_words disable trigger heritage_word_before_save;
  alter table public.heritage_words disable trigger heritage_words_before_write;
  alter table public.heritage_words disable trigger heritage_words_audit;
  alter table public.heritage_words disable trigger heritage_words_slug_history;
  alter table public.heritage_words disable trigger heritage_word_areas_project;
  alter table public.heritage_words disable trigger heritage_word_areas_sync;
  for word in select id, entry from public.heritage_words order by created_at, id loop
    new_entry := public.rewrite_area_ids_in_jsonb(word.entry, legacy_map);
    area_uuids := public.word_entry_area_ids(new_entry);
    update public.heritage_words
    set entry = new_entry, areas = public.areas_hierarchy_jsonb(area_uuids)
    where id = word.id;
    insert into public.heritage_word_areas (word_id, area_id)
    select word.id, unnest(area_uuids)
    on conflict do nothing;
  end loop;
  alter table public.heritage_words enable trigger heritage_word_areas_sync;
  alter table public.heritage_words enable trigger heritage_word_areas_project;
  alter table public.heritage_words enable trigger heritage_words_slug_history;
  alter table public.heritage_words enable trigger heritage_words_audit;
  alter table public.heritage_words enable trigger heritage_words_before_write;
  alter table public.heritage_words enable trigger heritage_word_before_save;
end $$;

-- 5. Access and grants ---------------------------------------------------------------------

revoke all on function
  public.heritage_word_areas_project(),
  public.resolve_area_id(text),
  public.word_entry_area_ids(jsonb),
  public.areas_hierarchy_jsonb(uuid[]),
  public.rewrite_area_ids_in_jsonb(jsonb, jsonb),
  public.heritage_word_areas_sync()
from public, anon, authenticated;

grant execute on function
  public.resolve_area_id(text),
  public.word_entry_area_ids(jsonb),
  public.areas_hierarchy_jsonb(uuid[])
to service_role;
