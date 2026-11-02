-- Word admin columns: heritage_words joins the content-table conventions of 20261103010000_content_tables.sql
-- without changing its id type. Ids stay text (20261102120000_reload_seed_words.sql already gave every word a
-- UUID string, and the app inserts randomUUID() strings), so nothing that references words changes.
--
-- What it adds:
-- * heritage_words_id_uuid: every id is a lowercase UUID string. Polymorphic uuid columns
--   (content_revisions.entity_id) store id::uuid and compare as id = entity_id::text, which needs lowercase.
-- * slug: unique, generated from the headword the first time one is set (homographs get -2, -3, …) and never
--   changed automatically after that, so a future dictionary URL stays stable. Never used as an id.
-- * revision (managed by the database, like on every content table), archived_at (set when a word is
--   archived; activating a word clears it) and search_text (accent-folded headword, forms and meanings).
-- * Full history in content_revisions (entity_kind 'word'), with a baseline row for every existing word, and
--   slug history in content_slug_history (kind 'word') when a slug changes.
--
-- Additive: one check the running app's inserts already satisfy, plus defaulted or trigger-filled columns.
-- The previous app runs unchanged during the deploy window and after a rollback.

-- Fail with the offending ids rather than a bare constraint error if any non-UUID row survived.
do $$
declare
  bad text[];
begin
  select array_agg(id order by id) into bad from (
    select id from public.heritage_words
    where id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' order by id limit 20
  ) s;
  if bad is not null then
    raise exception 'heritage_words ids must be lowercase UUID strings; found %', bad
      using hint = 'Replace or delete these rows (and their heritage_daily_words rows) in a reviewed migration first.';
  end if;
end $$;
alter table public.heritage_words add constraint heritage_words_id_uuid
  check (id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- SQL twin of atlasSlug() in shared/utils/atlasSlug.ts: đ → dj, diacritics dropped, lowercase ASCII words
-- joined by single hyphens. Returns null where atlasSlug returns ''. Shared so every content slug follows one rule.
create function public.content_slug(value text) returns text language sql immutable set search_path = '' as $$
  select nullif(btrim(regexp_replace(lower(regexp_replace(
    normalize(replace(replace(coalesce(value, ''), 'Đ', 'dj'), 'đ', 'dj'), nfd),
    '[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︠-︯]', '', 'g')),
    '[^a-z0-9]+', '-', 'g'), '-'), '')
$$;

alter table public.heritage_words
  add column slug text constraint heritage_words_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  add column archived_at timestamptz,
  add column revision integer not null default 1 constraint heritage_words_revision_positive check (revision > 0),
  add column search_text text not null default '';
comment on column public.heritage_words.slug is
  'URL slug for a future dictionary page and admin deep links; generated from the first headword, never an id.';
comment on column public.heritage_words.archived_at is
  'Set when the word is archived (hidden, kept for references and history); activating the word clears it.';
comment on column public.heritage_words.revision is
  'Bumped by the database on every update; an API updating where revision = <expected> detects concurrent edits.';

-- A free slug for a headword: its content_slug (or 'rijec' when it has no letters or digits), then -2, -3, …
-- until no other word uses it. Null for a blank headword. Writers wanting the same base are serialized, so
-- concurrent homographs get distinct suffixes.
create function public.heritage_word_slug(headword text, word_id text) returns text language plpgsql set search_path = '' as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  if coalesce(btrim(headword), '') = '' then return null; end if;
  -- Headwords are at most 200 characters; keep room for a -N suffix within the 120-character limit.
  base := coalesce(rtrim(left(public.content_slug(headword), 100), '-'), 'rijec');
  perform pg_advisory_xact_lock(hashtextextended('heritage_words.slug:' || base, 0));
  candidate := base;
  while exists (select 1 from public.heritage_words where slug = candidate and id is distinct from word_id) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end;
$$;

-- Accent-folded headword, variant forms and Croatian and English meanings, for admin search.
create function public.heritage_word_search_text(entry jsonb) returns text language sql immutable set search_path = '' as $$
  select public.content_fold(concat_ws(' ', nullif(entry->>'headword', ''),
    (select string_agg(v->>'form', ' ' order by n) from jsonb_array_elements(
      case when jsonb_typeof(entry->'variants') = 'array' then entry->'variants' else '[]'::jsonb end) with ordinality as t(v, n)
     where jsonb_typeof(v) = 'object'),
    nullif(entry->'meaning'->>'hr', ''), nullif(entry->'meaning'->>'en', '')))
$$;

-- Backfill, oldest word first so the earlier homograph keeps the plain slug. The existing
-- heritage_word_before_save trigger is paused so updated_at keeps meaning "last edited", and the revision and
-- history triggers below do not exist yet, so the backfill is not an edit.
alter table public.heritage_words disable trigger heritage_word_before_save;
do $$
declare
  word record;
begin
  for word in select id, entry from public.heritage_words order by created_at, id loop
    update public.heritage_words
    set slug = public.heritage_word_slug(word.entry->>'headword', word.id), search_text = public.heritage_word_search_text(word.entry)
    where id = word.id;
  end loop;
end $$;
alter table public.heritage_words enable trigger heritage_word_before_save;

alter table public.heritage_words
  add constraint heritage_words_slug_key unique (slug),
  -- Active words always have a headword, so the trigger below always gives them a slug.
  add constraint heritage_words_active_slug check (not active or slug is not null);

-- History starts with a snapshot of every existing word, so the first edit can be undone.
insert into public.content_revisions (entity_kind, entity_id, revision, action, data, actor)
select 'word', id::uuid, revision, 'insert', to_jsonb(w) - 'search_text', 'import'
from public.heritage_words w order by created_at, id;

-- BEFORE INSERT OR UPDATE: the content_before_write conventions (immutable id, database-managed revision,
-- created_at kept, updated_at set) plus the word's derived columns. heritage_word_before_save keeps its own
-- job (approving the linked submission on activation).
create function public.heritage_words_before_write() returns trigger language plpgsql set search_path = '' as $$
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
  -- Activating an archived word brings it back.
  if new.active then new.archived_at := null; end if;
  -- A slug is chosen once, from the first non-blank headword; clearing it asks for a new one.
  if new.slug is null then new.slug := public.heritage_word_slug(new.entry->>'headword', new.id); end if;
  new.search_text := public.heritage_word_search_text(new.entry);
  return new;
end;
$$;

-- Same function as in 20261103010000_content_tables.sql, except that the entity id is read through jsonb and
-- cast, as content_audit does, so it also serves tables whose UUID id is stored as text (heritage_words).
-- Behaviour for the uuid-keyed content tables is unchanged; create or replace keeps the existing grants.
create or replace function public.content_slug_history_write() returns trigger language plpgsql set search_path = '' as $$
declare
  old_scope uuid := case when tg_nargs > 1 then (to_jsonb(old)->>tg_argv[1])::uuid end;
  new_scope uuid := case when tg_nargs > 1 then (to_jsonb(new)->>tg_argv[1])::uuid end;
  old_ns text := case when tg_argv[0] = 'area' then public.area_route_namespace(to_jsonb(old)->>'kind') else '' end;
  new_ns text := case when tg_argv[0] = 'area' then public.area_route_namespace(to_jsonb(new)->>'kind') else '' end;
begin
  if old.slug is null or (tg_nargs > 1 and old_scope is null) then return null; end if;
  if old.slug is distinct from new.slug or old_scope is distinct from new_scope or old_ns <> new_ns then
    insert into public.content_slug_history (kind, namespace, scope_id, slug, entity_id)
    values (tg_argv[0], old_ns, old_scope, old.slug, (to_jsonb(old)->>'id')::uuid)
    on conflict (kind, namespace, scope_id, slug) do update set entity_id = excluded.entity_id, created_at = now();
  end if;
  return null;
end;
$$;

create trigger heritage_words_before_write before insert or update on public.heritage_words
  for each row execute function public.heritage_words_before_write();
create trigger heritage_words_audit after insert or update or delete on public.heritage_words
  for each row execute function public.content_audit('word');
create trigger heritage_words_slug_history after update of slug on public.heritage_words
  for each row execute function public.content_slug_history_write('word');

-- Helpers stay server-only, like content_fold and content_uuid; trigger functions need no EXECUTE to fire.
revoke all on function public.content_slug(text), public.heritage_word_slug(text, text), public.heritage_word_search_text(jsonb),
  public.heritage_words_before_write() from public, anon, authenticated;
grant execute on function public.content_slug(text), public.heritage_word_slug(text, text), public.heritage_word_search_text(jsonb)
  to service_role;
