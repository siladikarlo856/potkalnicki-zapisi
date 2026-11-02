-- Content tables: the database home of the atlas (areas, heritage categories, sources, heritage
-- items) plus the shared bookkeeping every content row gets (legacy ids, slug history, revisions).
-- Additive: no existing table, column, trigger or function changes, and nothing reads these tables
-- yet, so the running app ignores them. Rows arrive in a later seed migration.
--
-- Conventions for every content table:
-- * id uuid primary key; imported rows get deterministic ids from content_uuid('<kind>:<legacy id>').
-- * status draft | published | archived; only published rows will be public.
-- * revision is managed by the database: a BEFORE trigger bumps it on every update, and an API that
--   updates "where revision = <expected>" gets zero rows back on a concurrent edit.
-- * every insert, update and delete is copied in full to content_revisions; the actor comes from the
--   transaction setting app.actor ('admin' when unset, 'import' in seed migrations).
-- * search_text is an accent-folded copy of the searchable columns, maintained by the same trigger.
-- * RLS on, nothing granted to public, anon or authenticated; only the server's service_role key.

-- Deterministic UUIDv8 (RFC 9562) from a name: MD5 of the name with the version nibble set to 8 and
-- the variant bits to 10. Node equivalent: md5 bytes, b[6] = (b[6] & 0x0f) | 0x80,
-- b[8] = (b[8] & 0x3f) | 0x80. Import scripts and tests rely on both producing the same value.
create function public.content_uuid(name text) returns uuid language sql immutable strict set search_path = '' as $$
  select overlay(overlay(md5(name) placing '8' from 13)
    placing substr('89ab', ((get_byte(decode(md5(name), 'hex'), 8) >> 4) & 3) + 1, 1) from 17)::uuid
$$;

-- Accent-folded, lowercased text for search: čćđšž → ccdsz.
create function public.content_fold(value text) returns text language sql immutable set search_path = '' as $$
  select lower(translate(coalesce(value, ''), 'ČĆĐŠŽčćđšž', 'CCDSZccdsz'))
$$;

-- Places, one hierarchy for both the atlas and word usages:
-- country → county → town | municipality → settlement, with regions (country or county children)
-- grouping areas through area_regions. The parent kind is enforced by trigger, which also makes
-- cycles impossible because every kind sits strictly below its parent's.
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('country', 'county', 'region', 'town', 'municipality', 'settlement')),
  parent_id uuid references public.areas(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  slug text check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  official_code text check (char_length(btrim(official_code)) between 1 and 40),
  geonames_id text check (geonames_id ~ '^[0-9]{1,10}$'),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  description text check (char_length(description) <= 10000),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  revision integer not null default 1 check (revision > 0),
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint areas_coordinates_pair check ((latitude is null) = (longitude is null)),
  constraint areas_root_is_country check ((kind = 'country') = (parent_id is null)),
  constraint areas_routable_slug check (status <> 'published' or kind not in ('town', 'municipality', 'settlement') or slug is not null)
);
comment on table public.areas is
  'Places: country, county, region, town, municipality, settlement. Towns and municipalities share one public URL namespace.';
comment on column public.areas.official_code is 'Official statistical code, e.g. the DGU settlement code.';
-- Towns and municipalities are both served from /istrazi/<slug>, so they share one slug namespace.
create function public.area_route_namespace(kind text) returns text language sql immutable set search_path = '' as $$
  select case when kind in ('town', 'municipality') then 'lau' else kind end
$$;
create unique index areas_route_slug on public.areas (public.area_route_namespace(kind), slug) where slug is not null;
create unique index areas_official_code on public.areas (kind, official_code) where official_code is not null;
create unique index areas_geonames on public.areas (geonames_id) where geonames_id is not null;
create index areas_parent on public.areas (parent_id);

-- Region membership, e.g. the five municipalities of Potkalničko prigorje. Replaces scope lists in code.
create table public.area_regions (
  area_id uuid not null references public.areas(id) on delete cascade,
  region_id uuid not null references public.areas(id) on delete restrict,
  primary key (area_id, region_id)
);
create index area_regions_region on public.area_regions (region_id);

create table public.heritage_categories (
  id uuid primary key default gen_random_uuid(),
  -- Stable identifier used by code and quizzes; labels are what admins rename.
  key text not null unique check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(key) <= 60),
  label_hr text not null check (char_length(btrim(label_hr)) between 1 and 100),
  label_en text check (char_length(label_en) <= 100),
  sort integer not null default 0,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  revision integer not null default 1 check (revision > 0),
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 500),
  type text not null check (type in ('official_registry', 'conservation_study', 'conservation_document', 'planning_document',
    'development_document', 'municipal_source', 'publication', 'dictionary', 'interview', 'website', 'other')),
  url text check (url ~ '^https?://[^\s]+$' and char_length(url) <= 1000),
  note text check (char_length(note) <= 2000),
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  revision integer not null default 1 check (revision > 0),
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Churches, chapels, crosses, sites. verification is the editorial state shown as the public badge;
-- status is publication. The settlement, when set, must belong to the municipality (trigger below).
create table public.heritage_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  category_id uuid not null references public.heritage_categories(id) on delete restrict,
  municipality_id uuid not null references public.areas(id) on delete restrict,
  settlement_id uuid references public.areas(id) on delete restrict,
  locality text check (char_length(locality) <= 200),
  verification text not null default 'unverified' check (verification in ('unverified', 'in_review', 'verified', 'needs_update')),
  heritage_status text check (heritage_status in ('needs_verification', 'historical_site', 'protected')),
  registry_number text check (char_length(registry_number) <= 40),
  period text check (char_length(period) <= 200),
  description text check (char_length(description) <= 20000),
  research_notes text not null default '' check (char_length(research_notes) <= 5000),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  noindex boolean not null default false,
  credits jsonb not null default '[]' check (jsonb_typeof(credits) = 'array' and octet_length(credits::text) <= 8192),
  -- Provenance: the record id in the source dataset this row was imported from.
  dataset_id text unique check (char_length(dataset_id) between 1 and 200),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  revision integer not null default 1 check (revision > 0),
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint heritage_items_coordinates_pair check ((latitude is null) = (longitude is null))
);
-- Public URL /bastina/<settlement slug>/<item slug>: unique within a settlement.
create unique index heritage_items_settlement_slug on public.heritage_items (settlement_id, slug) where settlement_id is not null;
create index heritage_items_municipality on public.heritage_items (municipality_id);
create index heritage_items_category on public.heritage_items (category_id);

-- Ordered sources cited by an item. Deleting an item drops its links; a cited source cannot be deleted.
create table public.heritage_item_sources (
  item_id uuid not null references public.heritage_items(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (item_id, source_id)
);
create index heritage_item_sources_source on public.heritage_item_sources (source_id);

-- Pre-UUID ids that may still arrive from links, submissions' target_ref or browser storage.
-- entity_id is polymorphic (no FK) and survives a hard delete, so a restored row resolves again.
create table public.content_legacy_ids (
  kind text not null check (kind in ('area', 'heritage_item', 'heritage_category', 'source', 'word')),
  legacy_id text not null check (char_length(legacy_id) between 1 and 200),
  entity_id uuid not null,
  primary key (kind, legacy_id)
);
create index content_legacy_ids_entity on public.content_legacy_ids (entity_id);

-- Old public slugs, written by trigger when a routable slug or its scope changes, so old URLs can
-- redirect. scope_id is the settlement for heritage items and null for areas; namespace is the old row's
-- URL namespace for areas (as in areas_route_slug) and empty otherwise.
create table public.content_slug_history (
  kind text not null check (kind in ('area', 'heritage_item', 'word')),
  namespace text not null default '' check (char_length(namespace) <= 40),
  scope_id uuid,
  slug text not null check (char_length(slug) between 1 and 200),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  constraint content_slug_history_key unique nulls not distinct (kind, namespace, scope_id, slug)
);
create index content_slug_history_entity on public.content_slug_history (entity_id);

-- Full row snapshot of every write, deletes included, so any version can be restored.
create table public.content_revisions (
  id bigint generated always as identity primary key,
  entity_kind text not null check (entity_kind ~ '^[a-z][a-z_]{0,59}$'),
  entity_id uuid not null,
  revision integer not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  submission_id bigint references public.heritage_submissions(id) on delete set null,
  actor text not null default 'admin' check (char_length(actor) between 1 and 60),
  created_at timestamptz not null default now()
);
create index content_revisions_entity on public.content_revisions (entity_kind, entity_id, id desc);
create index content_revisions_submission on public.content_revisions (submission_id) where submission_id is not null;

-- BEFORE INSERT OR UPDATE on every content table. Arguments: the columns that feed search_text.
create function public.content_before_write() returns trigger language plpgsql set search_path = '' as $$
declare
  row_json jsonb;
  parts text[] := '{}';
  col text;
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id then raise exception 'id is immutable' using errcode = 'check_violation'; end if;
    if new.revision <> old.revision then
      raise exception 'revision is managed by the database' using errcode = 'check_violation';
    end if;
    new.revision := old.revision + 1;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  row_json := to_jsonb(new);
  foreach col in array tg_argv loop
    if nullif(row_json->>col, '') is not null then parts := parts || (row_json->>col); end if;
  end loop;
  new.search_text := public.content_fold(array_to_string(parts, ' '));
  return new;
end;
$$;

-- AFTER INSERT OR UPDATE OR DELETE on every content table. Argument: the entity kind.
create function public.content_audit() returns trigger language plpgsql set search_path = '' as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.content_revisions (entity_kind, entity_id, revision, action, data, actor)
  values (tg_argv[0], (rec->>'id')::uuid,
    case when tg_op = 'DELETE' then old.revision + 1 else new.revision end,
    lower(tg_op), rec - 'search_text',
    coalesce(nullif(current_setting('app.actor', true), ''), 'admin'));
  return null;
end;
$$;

-- AFTER UPDATE of a routable slug. Arguments: the slug-history kind and, optionally, the scope column.
-- A scoped row with no scope (an item without a settlement) has no public URL, so nothing is kept.
create function public.content_slug_history_write() returns trigger language plpgsql set search_path = '' as $$
declare
  old_scope uuid := case when tg_nargs > 1 then (to_jsonb(old)->>tg_argv[1])::uuid end;
  new_scope uuid := case when tg_nargs > 1 then (to_jsonb(new)->>tg_argv[1])::uuid end;
  old_ns text := case when tg_argv[0] = 'area' then public.area_route_namespace(to_jsonb(old)->>'kind') else '' end;
  new_ns text := case when tg_argv[0] = 'area' then public.area_route_namespace(to_jsonb(new)->>'kind') else '' end;
begin
  if old.slug is null or (tg_nargs > 1 and old_scope is null) then return null; end if;
  if old.slug is distinct from new.slug or old_scope is distinct from new_scope or old_ns <> new_ns then
    insert into public.content_slug_history (kind, namespace, scope_id, slug, entity_id)
    values (tg_argv[0], old_ns, old_scope, old.slug, old.id)
    on conflict (kind, namespace, scope_id, slug) do update set entity_id = excluded.entity_id, created_at = now();
  end if;
  return null;
end;
$$;

-- Area hierarchy and the rows that depend on an area's kind.
create function public.area_parent_kinds(kind text) returns text[] language sql immutable set search_path = '' as $$
  select case kind
    when 'country' then '{}'::text[]
    when 'county' then '{country}'::text[]
    when 'region' then '{country,county}'::text[]
    when 'town' then '{county}'::text[]
    when 'municipality' then '{county}'::text[]
    when 'settlement' then '{town,municipality}'::text[]
  end
$$;

create function public.areas_hierarchy_check() returns trigger language plpgsql set search_path = '' as $$
declare
  parent_kind text;
begin
  -- A country with a parent is left to the areas_root_is_country check.
  if new.parent_id is not null and new.kind <> 'country' then
    select kind into parent_kind from public.areas where id = new.parent_id;
    -- A missing parent is left to the foreign key, which reports it more precisely.
    if found and not parent_kind = any(public.area_parent_kinds(new.kind)) then
      raise exception 'The parent of a % must be one of %, not a %', new.kind, public.area_parent_kinds(new.kind), parent_kind
        using errcode = 'check_violation';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.kind <> old.kind then
    if exists (select 1 from public.areas where parent_id = new.id and not new.kind = any(public.area_parent_kinds(kind))) then
      raise exception 'A % cannot become a %: it has child areas that need a different parent', old.kind, new.kind
        using errcode = 'check_violation';
    end if;
    if new.kind not in ('town', 'municipality') and exists (select 1 from public.heritage_items where municipality_id = new.id) then
      raise exception 'A % with heritage items must stay a town or municipality', old.kind using errcode = 'check_violation';
    end if;
    if new.kind <> 'settlement' and exists (select 1 from public.heritage_items where settlement_id = new.id) then
      raise exception 'A settlement with heritage items must stay a settlement' using errcode = 'check_violation';
    end if;
    if new.kind <> 'region' and exists (select 1 from public.area_regions where region_id = new.id) then
      raise exception 'A region with members must stay a region' using errcode = 'check_violation';
    end if;
    if new.kind in ('country', 'region') and exists (select 1 from public.area_regions where area_id = new.id) then
      raise exception 'A % cannot be a region member', new.kind using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- Moving a settlement to another town or municipality carries its heritage items along, so the
-- item rule "settlement belongs to the municipality" keeps holding (and each item gets a revision).
create function public.areas_after_move() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind = 'settlement' and new.parent_id is distinct from old.parent_id then
    update public.heritage_items set municipality_id = new.parent_id
    where settlement_id = new.id and municipality_id is distinct from new.parent_id;
  end if;
  return null;
end;
$$;

create function public.area_regions_check() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.areas where id = new.region_id and kind = 'region') then
    raise exception 'region_id must be a region' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.areas where id = new.area_id and kind in ('country', 'region')) then
    raise exception 'Only counties, towns, municipalities and settlements can be region members' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create function public.heritage_item_place_check() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.areas where id = new.municipality_id and kind in ('town', 'municipality')) then
    raise exception 'municipality_id must be a town or municipality' using errcode = 'check_violation';
  end if;
  if new.settlement_id is not null and not exists (
    select 1 from public.areas where id = new.settlement_id and kind = 'settlement' and parent_id = new.municipality_id) then
    raise exception 'settlement_id must be a settlement of the chosen municipality' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger areas_before_write before insert or update on public.areas
  for each row execute function public.content_before_write('name', 'slug', 'official_code', 'kind');
create trigger areas_hierarchy_check before insert or update of kind, parent_id on public.areas
  for each row execute function public.areas_hierarchy_check();
create trigger areas_after_move after update of parent_id on public.areas
  for each row execute function public.areas_after_move();
create trigger areas_audit after insert or update or delete on public.areas
  for each row execute function public.content_audit('area');
create trigger areas_slug_history after update of slug, kind on public.areas
  for each row execute function public.content_slug_history_write('area');
create trigger area_regions_check before insert or update on public.area_regions
  for each row execute function public.area_regions_check();
create trigger heritage_categories_before_write before insert or update on public.heritage_categories
  for each row execute function public.content_before_write('key', 'label_hr', 'label_en');
create trigger heritage_categories_audit after insert or update or delete on public.heritage_categories
  for each row execute function public.content_audit('heritage_category');
create trigger sources_before_write before insert or update on public.sources
  for each row execute function public.content_before_write('title', 'type', 'url');
create trigger sources_audit after insert or update or delete on public.sources
  for each row execute function public.content_audit('source');
create trigger heritage_items_place_check before insert or update of municipality_id, settlement_id on public.heritage_items
  for each row execute function public.heritage_item_place_check();
create trigger heritage_items_before_write before insert or update on public.heritage_items
  for each row execute function public.content_before_write('name', 'slug', 'locality', 'registry_number');
create trigger heritage_items_audit after insert or update or delete on public.heritage_items
  for each row execute function public.content_audit('heritage_item');
create trigger heritage_items_slug_history after update of slug, settlement_id on public.heritage_items
  for each row execute function public.content_slug_history_write('heritage_item', 'settlement_id');

-- Server-only access, like every other table: RLS on, no public grants, service_role only.
do $$
declare t text;
begin
  foreach t in array array['areas', 'area_regions', 'heritage_categories', 'sources', 'heritage_items', 'heritage_item_sources',
    'content_legacy_ids', 'content_slug_history', 'content_revisions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', t);
    execute format('grant all privileges on table public.%I to service_role', t);
  end loop;
end $$;
revoke all privileges on sequence public.content_revisions_id_seq from public, anon, authenticated;
grant usage, select on sequence public.content_revisions_id_seq to service_role;
-- Functions default to EXECUTE for PUBLIC. The helpers are called inside triggers as the writing role
-- and by seed migrations, so service_role keeps them; trigger functions need no EXECUTE to fire.
revoke all on function public.content_uuid(text), public.content_fold(text), public.area_parent_kinds(text), public.area_route_namespace(text),
  public.content_before_write(), public.content_audit(), public.content_slug_history_write(),
  public.areas_hierarchy_check(), public.areas_after_move(), public.area_regions_check(),
  public.heritage_item_place_check() from public, anon, authenticated;
grant execute on function public.content_uuid(text), public.content_fold(text), public.area_parent_kinds(text), public.area_route_namespace(text) to service_role;
