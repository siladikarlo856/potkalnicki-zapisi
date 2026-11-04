-- Person records for Learn and Play (WP17). Additive: widened kind checks accept old writes; nothing public reads these until WP18.
-- Apply before deploying the matching app.

create table public.persons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  role text not null default '' check (char_length(role) <= 200),
  clue text not null default '' check (char_length(clue) <= 300),
  bio text check (char_length(bio) <= 4000),
  born text check (char_length(born) <= 60),
  born_year integer check (born_year between 1000 and 2100),
  born_place text check (char_length(born_place) <= 200),
  died text not null check (char_length(btrim(died)) between 1 and 60),
  died_year integer not null check (died_year between 1000 and 2100),
  died_place text check (char_length(died_place) <= 200),
  open_questions text check (char_length(open_questions) <= 2000),
  research_notes text not null default '' check (char_length(research_notes) <= 5000),
  verification text not null default 'unverified' check (verification in ('unverified', 'in_review', 'verified', 'needs_update')),
  noindex boolean not null default false,
  credits jsonb not null default '[]' check (jsonb_typeof(credits) = 'array' and octet_length(credits::text) <= 8192),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  revision integer not null default 1 check (revision > 0),
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint persons_years check (born_year is null or born_year <= died_year)
);

create table public.person_areas (
  person_id uuid not null references public.persons(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete restrict,
  role text not null check (role in ('rodjen', 'zivio', 'djelovao', 'umro', 'pokopan')),
  position smallint not null check (position >= 0),
  primary key (person_id, area_id, role)
);
create index person_areas_area on public.person_areas (area_id);

create table public.person_heritage_items (
  person_id uuid not null references public.persons(id) on delete cascade,
  item_id uuid not null references public.heritage_items(id) on delete restrict,
  relation text not null check (char_length(btrim(relation)) between 1 and 200),
  position smallint not null check (position >= 0),
  primary key (person_id, item_id)
);
create index person_heritage_items_item on public.person_heritage_items (item_id);

create table public.person_sources (
  person_id uuid not null references public.persons(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (person_id, source_id)
);
create index person_sources_source on public.person_sources (source_id);

alter table public.persons
  add column source_submission_id bigint unique references public.heritage_submissions(id) on delete set null,
  add column apply_submission_id bigint,
  add column apply_credit boolean;

create trigger persons_before_write before insert or update on public.persons
  for each row execute function public.content_before_write('name', 'slug', 'role', 'clue', 'born_place', 'died_place');
create trigger persons_audit after insert or update or delete on public.persons
  for each row execute function public.content_audit('person');
create trigger persons_slug_history after update of slug on public.persons
  for each row execute function public.content_slug_history_write('person');
create trigger persons_apply_submission before insert or update on public.persons
  for each row execute function public.content_apply_submission('person');

alter table public.content_legacy_ids drop constraint content_legacy_ids_kind_check;
alter table public.content_legacy_ids add constraint content_legacy_ids_kind_check check (
  kind in ('area', 'heritage_item', 'heritage_category', 'source', 'word', 'person')
);

alter table public.content_slug_history drop constraint content_slug_history_kind_check;
alter table public.content_slug_history add constraint content_slug_history_kind_check check (
  kind in ('area', 'heritage_item', 'word', 'person')
);

alter table public.heritage_submissions drop constraint heritage_submissions_target_kind_check;
alter table public.heritage_submissions add constraint heritage_submissions_target_kind_check check (
  target_kind in ('word', 'heritage_item', 'area', 'source', 'person')
);

create or replace function public.heritage_submission_withdraw() returns trigger
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

  if old.type = 'proposal' then
    update public.heritage_items set status = 'draft' where source_submission_id = old.id and status = 'published';
    update public.areas set status = 'draft' where source_submission_id = old.id and status = 'published';
    update public.sources set status = 'draft' where source_submission_id = old.id and status = 'published';
    update public.persons set status = 'draft' where source_submission_id = old.id and status = 'published';
  end if;
  if TG_OP = 'DELETE' or old.type = 'proposal' then
    perform public.redact_submission_credit(old.id);
  end if;
  return case when TG_OP = 'DELETE' then old else new end;
end;
$$;

create or replace function public.redact_submission_credit(p_submission_id bigint) returns void language plpgsql set search_path = '' as $$
declare
  sub record;
  ref text;
begin
  select credit_ref, applied_entity_id into sub from public.heritage_submissions where id = p_submission_id;
  if not found or sub.credit_ref is null then return; end if;
  ref := sub.credit_ref::text;

  update public.heritage_items set credits = (
    select coalesce(jsonb_agg(c order by o), '[]'::jsonb) from jsonb_array_elements(credits) with ordinality as t(c, o) where c->>'id' is distinct from ref)
  where id = sub.applied_entity_id and exists (select 1 from jsonb_array_elements(credits) c where c->>'id' = ref);
  update public.areas set credits = (
    select coalesce(jsonb_agg(c order by o), '[]'::jsonb) from jsonb_array_elements(credits) with ordinality as t(c, o) where c->>'id' is distinct from ref)
  where id = sub.applied_entity_id and exists (select 1 from jsonb_array_elements(credits) c where c->>'id' = ref);
  update public.persons set credits = (
    select coalesce(jsonb_agg(c order by o), '[]'::jsonb) from jsonb_array_elements(credits) with ordinality as t(c, o) where c->>'id' is distinct from ref)
  where id = sub.applied_entity_id and exists (select 1 from jsonb_array_elements(credits) c where c->>'id' = ref);
  update public.heritage_words set entry = jsonb_set(entry, '{sources}', (
    select coalesce(jsonb_agg(s order by o), '[]'::jsonb) from jsonb_array_elements(entry->'sources') with ordinality as t(s, o) where s->>'id' is distinct from ref))
  where id = sub.applied_entity_id::text and exists (select 1 from jsonb_array_elements(entry->'sources') s where s->>'id' = ref);

  update public.content_revisions set data = jsonb_set(data, '{credits}', (
    select coalesce(jsonb_agg(c order by o), '[]'::jsonb) from jsonb_array_elements(data->'credits') with ordinality as t(c, o) where c->>'id' is distinct from ref))
  where entity_id = sub.applied_entity_id and entity_kind in ('heritage_item', 'area', 'person') and jsonb_typeof(data->'credits') = 'array'
    and exists (select 1 from jsonb_array_elements(data->'credits') c where c->>'id' = ref);
  update public.content_revisions set data = jsonb_set(data, '{entry,sources}', (
    select coalesce(jsonb_agg(s order by o), '[]'::jsonb) from jsonb_array_elements(data->'entry'->'sources') with ordinality as t(s, o) where s->>'id' is distinct from ref))
  where entity_id = sub.applied_entity_id and entity_kind = 'word' and jsonb_typeof(data->'entry'->'sources') = 'array'
    and exists (select 1 from jsonb_array_elements(data->'entry'->'sources') s where s->>'id' = ref);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['persons', 'person_areas', 'person_heritage_items', 'person_sources'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', t);
    execute format('grant all privileges on table public.%I to service_role', t);
  end loop;
end $$;
