-- Intangible heritage (Nematerijalna baština): what the people of the region told, said, sang and did, as three
-- content kinds of their own (docs/adr/0001-intangible-heritage-content-kinds.md), separate from heritage items:
--
-- * Story (Priča, stories), Custom (Običaj, customs) and Folk text (Usmeni tekst, folk_texts), each with one
--   editor-managed type list (story_types, custom_types, folk_text_types), plus the Occasions a Custom belongs
--   to (occasions) and the Themes any kind can share (themes).
-- * Per kind, link tables for places (recorded in / about, any area level), people (narrator, collector, author),
--   heritage items, themes and ordered sources; a Folk text also links to the Words it contains and to the Custom
--   it belonged to.
-- * Memories (heritage_submissions of type 'memory') feed Drafts the way Proposals do: a Draft made from a Memory
--   points back at it (source_submission_id); publishing the Draft applies the Memory, which approves it and
--   credits its sender; rejecting or deleting the Memory unpublishes the Draft and strips the credit again.
--
-- Additive: no existing table or column changes; widened checks only accept more, and the two submission functions
-- keep their behaviour for everything they handled before. Nothing reads these tables yet, so the running app
-- ignores them. The type lists are filled by 20261108020000_seed_intangible_types.sql.
--
-- Conventions are those of 20261103010000_content_tables.sql: UUID ids, status draft | published | archived,
-- a database-managed revision, search_text kept by content_before_write, every write copied to content_revisions
-- by content_audit, RLS on with nothing granted to public, anon or authenticated (service_role only).
-- Every reference is `on delete restrict`, except that deleting a record drops its own link rows.

-- A date known only as precisely as it is: 'year', 'month' or 'day', with the parts below that precision null,
-- or no date at all. Never a guessed exact day: a year is stored as a year. Used by a CHECK on the three kinds.
create function public.content_partial_date_valid(p_precision text, p_year integer, p_month integer, p_day integer)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(case
    when p_precision is null then p_year is null and p_month is null and p_day is null
    when p_precision = 'year' then p_year between 1000 and 2100 and p_month is null and p_day is null
    when p_precision = 'month' then p_year between 1000 and 2100 and p_month between 1 and 12 and p_day is null
    when p_precision = 'day' then
      case when p_year between 1000 and 2100 and p_month between 1 and 12 and p_day >= 1
        then p_day <= case
          when p_month in (4, 6, 9, 11) then 30
          when p_month = 2 then case when (p_year % 4 = 0 and p_year % 100 <> 0) or p_year % 400 = 0 then 29 else 28 end
          else 31
        end
        else false
      end
    else false
  end, false)
$$;

-- Editor-managed lists, in the shape of heritage_categories: a stable key used by code and filters, Croatian and
-- English labels, a sort order. A list entry in use cannot be deleted (archive it instead).
create table public.story_types (
  id uuid primary key default gen_random_uuid(),
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
create table public.custom_types (like public.story_types including all);
create table public.folk_text_types (like public.story_types including all);
-- The named day, feast or life event a Custom belongs to (Martinje, a wedding).
create table public.occasions (like public.story_types including all);
comment on table public.story_types is 'Story types (Vrsta priče): the one kind a Story belongs to, editor-managed.';
comment on table public.custom_types is 'Custom types (Vrsta običaja): the one kind a Custom belongs to, editor-managed.';
comment on table public.folk_text_types is 'Folk text types (Vrsta usmenog teksta): the one kind a Folk text belongs to, editor-managed.';
comment on table public.occasions is 'Occasions (Prigoda): the named day, feast or life event a Custom belongs to, editor-managed.';

-- A subject any number of Stories, Customs and Folk texts can share, with a public page of its own (hence the slug).
create table public.themes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  label_hr text not null check (char_length(btrim(label_hr)) between 1 and 100),
  label_en text check (char_length(label_en) <= 100),
  description text check (char_length(description) <= 5000),
  sort integer not null default 0,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  revision integer not null default 1 check (revision > 0),
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.themes is 'Themes (Tema): editor-managed subjects shared across Stories, Customs and Folk texts.';

-- Something people told. text_local is the original telling in local speech, text_standard a standard Croatian
-- retelling; a Published Story has at least one of them.
--
-- Columns every one of the three kinds shares:
-- * recorded_*: when it was told or collected (Recorded on), as precise as known (content_partial_date_valid).
-- * verification: the editorial scale, which for these kinds confirms the attestation (really told or practised here,
--   in this form), never the truth of the content, and never blocks publishing.
-- * credits: consenting named contributors, added by content_apply_submission when a Draft made from a Memory is
--   published and removed again by redact_submission_credit.
-- * source_submission_id: the Memory a Draft was made from. apply_submission_id and apply_credit are transient, like
--   on every other content table.
-- * period (Set in / Practised): the era in the words people use, with an optional approximate decade
--   (period_value = first year, a multiple of 10) or century (period_value = 1..21) whose start year is kept in
--   period_sort_year, so records can be ordered by time.
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  type_id uuid not null references public.story_types(id) on delete restrict,
  text_local text check (char_length(btrim(text_local)) between 1 and 30000),
  text_standard text check (char_length(btrim(text_standard)) between 1 and 30000),
  period text check (char_length(btrim(period)) between 1 and 200),
  period_unit text check (period_unit in ('decade', 'century')),
  period_value smallint,
  period_sort_year integer generated always as (
    case period_unit when 'decade' then period_value when 'century' then (period_value - 1) * 100 + 1 end
  ) stored,
  recorded_precision text check (recorded_precision in ('year', 'month', 'day')),
  recorded_year smallint,
  recorded_month smallint,
  recorded_day smallint,
  verification text not null default 'unverified' check (verification in ('unverified', 'in_review', 'verified', 'needs_update')),
  research_notes text not null default '' check (char_length(research_notes) <= 5000),
  noindex boolean not null default false,
  credits jsonb not null default '[]' check (jsonb_typeof(credits) = 'array' and octet_length(credits::text) <= 8192),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  revision integer not null default 1 check (revision > 0),
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_submission_id bigint unique references public.heritage_submissions(id) on delete set null,
  apply_submission_id bigint,
  apply_credit boolean,
  constraint stories_recorded_on check (public.content_partial_date_valid(recorded_precision, recorded_year, recorded_month, recorded_day)),
  constraint stories_period_approx check (
    (period_unit is null and period_value is null)
    or (period_unit is not distinct from 'decade' and period_value is not null and period_value between 1000 and 2090 and period_value % 10 = 0)
    or (period_unit is not distinct from 'century' and period_value is not null and period_value between 1 and 21)
  ),
  constraint stories_published_text check (status <> 'published' or text_local is not null or text_standard is not null)
);
create index stories_type on public.stories (type_id);
create index stories_period_sort on public.stories (period_sort_year) where period_sort_year is not null;

-- Something people did, described in prose (description) with optional short quotes in local speech (quotes, a JSON
-- array of strings, in order). A Published Custom has a description.
create table public.customs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  type_id uuid not null references public.custom_types(id) on delete restrict,
  occasion_id uuid references public.occasions(id) on delete restrict,
  description text check (char_length(btrim(description)) between 1 and 30000),
  quotes jsonb not null default '[]' check (jsonb_typeof(quotes) = 'array' and octet_length(quotes::text) <= 8192),
  period text check (char_length(btrim(period)) between 1 and 200),
  period_unit text check (period_unit in ('decade', 'century')),
  period_value smallint,
  period_sort_year integer generated always as (
    case period_unit when 'decade' then period_value when 'century' then (period_value - 1) * 100 + 1 end
  ) stored,
  recorded_precision text check (recorded_precision in ('year', 'month', 'day')),
  recorded_year smallint,
  recorded_month smallint,
  recorded_day smallint,
  verification text not null default 'unverified' check (verification in ('unverified', 'in_review', 'verified', 'needs_update')),
  research_notes text not null default '' check (char_length(research_notes) <= 5000),
  noindex boolean not null default false,
  credits jsonb not null default '[]' check (jsonb_typeof(credits) = 'array' and octet_length(credits::text) <= 8192),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  revision integer not null default 1 check (revision > 0),
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_submission_id bigint unique references public.heritage_submissions(id) on delete set null,
  apply_submission_id bigint,
  apply_credit boolean,
  constraint customs_recorded_on check (public.content_partial_date_valid(recorded_precision, recorded_year, recorded_month, recorded_day)),
  constraint customs_period_approx check (
    (period_unit is null and period_value is null)
    or (period_unit is not distinct from 'decade' and period_value is not null and period_value between 1000 and 2090 and period_value % 10 = 0)
    or (period_unit is not distinct from 'century' and period_value is not null and period_value between 1 and 21)
  ),
  constraint customs_published_description check (status <> 'published' or description is not null)
);
create index customs_type on public.customs (type_id);
create index customs_occasion on public.customs (occasion_id) where occasion_id is not null;
create index customs_period_sort on public.customs (period_sort_year) where period_sort_year is not null;

-- A short fixed text people said or sang, where the exact wording is the record. custom_id is the Custom it belonged
-- to ("said or sung when"). A Published Folk text has at least one of text_local and text_standard. It has no period
-- of its own: its era is that of the Custom it belonged to, if any.
create table public.folk_texts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  type_id uuid not null references public.folk_text_types(id) on delete restrict,
  custom_id uuid references public.customs(id) on delete restrict,
  text_local text check (char_length(btrim(text_local)) between 1 and 30000),
  text_standard text check (char_length(btrim(text_standard)) between 1 and 30000),
  recorded_precision text check (recorded_precision in ('year', 'month', 'day')),
  recorded_year smallint,
  recorded_month smallint,
  recorded_day smallint,
  verification text not null default 'unverified' check (verification in ('unverified', 'in_review', 'verified', 'needs_update')),
  research_notes text not null default '' check (char_length(research_notes) <= 5000),
  noindex boolean not null default false,
  credits jsonb not null default '[]' check (jsonb_typeof(credits) = 'array' and octet_length(credits::text) <= 8192),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  revision integer not null default 1 check (revision > 0),
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_submission_id bigint unique references public.heritage_submissions(id) on delete set null,
  apply_submission_id bigint,
  apply_credit boolean,
  constraint folk_texts_recorded_on check (public.content_partial_date_valid(recorded_precision, recorded_year, recorded_month, recorded_day)),
  constraint folk_texts_published_text check (status <> 'published' or text_local is not null or text_standard is not null)
);
create index folk_texts_type on public.folk_texts (type_id);
create index folk_texts_custom on public.folk_texts (custom_id) where custom_id is not null;

comment on column public.stories.apply_submission_id is
  'Transient: set by the API on a write that applies a submission; the trigger clears it, so it is always null when stored.';
comment on column public.stories.source_submission_id is 'The Memory this Draft was made from; publishing the Draft applies the Memory and credits its sender.';

-- Stories: places, people, linked heritage items, themes and ordered sources.
create table public.story_areas (
  story_id uuid not null references public.stories(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete restrict,
  relation text not null check (relation in ('recorded_in', 'about')),
  position smallint not null check (position >= 0),
  primary key (story_id, area_id, relation)
);
create index story_areas_area on public.story_areas (area_id);

create table public.story_people (
  story_id uuid not null references public.stories(id) on delete cascade,
  position smallint not null check (position >= 0),
  role text not null check (role in ('narrator', 'collector', 'author')),
  person_id uuid references public.persons(id) on delete restrict,
  consent_named boolean not null default false,
  consent_note text check (char_length(consent_note) <= 500),
  description text check (char_length(btrim(description)) between 1 and 300),
  primary key (story_id, position),
  constraint story_people_who check (person_id is not null or description is not null),
  constraint story_people_consent_needs_person check (not consent_named or person_id is not null),
  constraint story_people_narrator_fallback check (role <> 'narrator' or consent_named or description is not null)
);
create unique index story_people_person_role on public.story_people (story_id, person_id, role) where person_id is not null;
create index story_people_person on public.story_people (person_id) where person_id is not null;

create table public.story_heritage_items (
  story_id uuid not null references public.stories(id) on delete cascade,
  item_id uuid not null references public.heritage_items(id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (story_id, item_id)
);
create index story_heritage_items_item on public.story_heritage_items (item_id);

create table public.story_themes (
  story_id uuid not null references public.stories(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (story_id, theme_id)
);
create index story_themes_theme on public.story_themes (theme_id);

create table public.story_sources (
  story_id uuid not null references public.stories(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (story_id, source_id)
);
create index story_sources_source on public.story_sources (source_id);

-- Customs: places, people, linked heritage items, themes and ordered sources.
create table public.custom_areas (
  custom_id uuid not null references public.customs(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete restrict,
  relation text not null check (relation in ('recorded_in', 'about')),
  position smallint not null check (position >= 0),
  primary key (custom_id, area_id, relation)
);
create index custom_areas_area on public.custom_areas (area_id);

create table public.custom_people (
  custom_id uuid not null references public.customs(id) on delete cascade,
  position smallint not null check (position >= 0),
  role text not null check (role in ('narrator', 'collector', 'author')),
  person_id uuid references public.persons(id) on delete restrict,
  consent_named boolean not null default false,
  consent_note text check (char_length(consent_note) <= 500),
  description text check (char_length(btrim(description)) between 1 and 300),
  primary key (custom_id, position),
  constraint custom_people_who check (person_id is not null or description is not null),
  constraint custom_people_consent_needs_person check (not consent_named or person_id is not null),
  constraint custom_people_narrator_fallback check (role <> 'narrator' or consent_named or description is not null)
);
create unique index custom_people_person_role on public.custom_people (custom_id, person_id, role) where person_id is not null;
create index custom_people_person on public.custom_people (person_id) where person_id is not null;

create table public.custom_heritage_items (
  custom_id uuid not null references public.customs(id) on delete cascade,
  item_id uuid not null references public.heritage_items(id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (custom_id, item_id)
);
create index custom_heritage_items_item on public.custom_heritage_items (item_id);

create table public.custom_themes (
  custom_id uuid not null references public.customs(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (custom_id, theme_id)
);
create index custom_themes_theme on public.custom_themes (theme_id);

create table public.custom_sources (
  custom_id uuid not null references public.customs(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (custom_id, source_id)
);
create index custom_sources_source on public.custom_sources (source_id);

-- Folk texts: places, people, linked heritage items, Words, themes and ordered sources.
create table public.folk_text_areas (
  folk_text_id uuid not null references public.folk_texts(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete restrict,
  relation text not null check (relation in ('recorded_in', 'about')),
  position smallint not null check (position >= 0),
  primary key (folk_text_id, area_id, relation)
);
create index folk_text_areas_area on public.folk_text_areas (area_id);

create table public.folk_text_people (
  folk_text_id uuid not null references public.folk_texts(id) on delete cascade,
  position smallint not null check (position >= 0),
  role text not null check (role in ('narrator', 'collector', 'author')),
  person_id uuid references public.persons(id) on delete restrict,
  consent_named boolean not null default false,
  consent_note text check (char_length(consent_note) <= 500),
  description text check (char_length(btrim(description)) between 1 and 300),
  primary key (folk_text_id, position),
  constraint folk_text_people_who check (person_id is not null or description is not null),
  constraint folk_text_people_consent_needs_person check (not consent_named or person_id is not null),
  constraint folk_text_people_narrator_fallback check (role <> 'narrator' or consent_named or description is not null)
);
create unique index folk_text_people_person_role on public.folk_text_people (folk_text_id, person_id, role) where person_id is not null;
create index folk_text_people_person on public.folk_text_people (person_id) where person_id is not null;

create table public.folk_text_heritage_items (
  folk_text_id uuid not null references public.folk_texts(id) on delete cascade,
  item_id uuid not null references public.heritage_items(id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (folk_text_id, item_id)
);
create index folk_text_heritage_items_item on public.folk_text_heritage_items (item_id);

create table public.folk_text_themes (
  folk_text_id uuid not null references public.folk_texts(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (folk_text_id, theme_id)
);
create index folk_text_themes_theme on public.folk_text_themes (theme_id);

create table public.folk_text_sources (
  folk_text_id uuid not null references public.folk_texts(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (folk_text_id, source_id)
);
create index folk_text_sources_source on public.folk_text_sources (source_id);

-- The dialect Words a Folk text contains. heritage_words ids are text.
create table public.folk_text_words (
  folk_text_id uuid not null references public.folk_texts(id) on delete cascade,
  word_id text not null references public.heritage_words(id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (folk_text_id, word_id)
);
create index folk_text_words_word on public.folk_text_words (word_id);

-- Triggers: search text and revision (content_before_write), history (content_audit), old slugs for redirects.
create trigger story_types_before_write before insert or update on public.story_types
  for each row execute function public.content_before_write('key', 'label_hr', 'label_en');
create trigger story_types_audit after insert or update or delete on public.story_types
  for each row execute function public.content_audit('story_type');
create trigger custom_types_before_write before insert or update on public.custom_types
  for each row execute function public.content_before_write('key', 'label_hr', 'label_en');
create trigger custom_types_audit after insert or update or delete on public.custom_types
  for each row execute function public.content_audit('custom_type');
create trigger folk_text_types_before_write before insert or update on public.folk_text_types
  for each row execute function public.content_before_write('key', 'label_hr', 'label_en');
create trigger folk_text_types_audit after insert or update or delete on public.folk_text_types
  for each row execute function public.content_audit('folk_text_type');
create trigger occasions_before_write before insert or update on public.occasions
  for each row execute function public.content_before_write('key', 'label_hr', 'label_en');
create trigger occasions_audit after insert or update or delete on public.occasions
  for each row execute function public.content_audit('occasion');
create trigger themes_before_write before insert or update on public.themes
  for each row execute function public.content_before_write('slug', 'label_hr', 'label_en');
create trigger themes_audit after insert or update or delete on public.themes
  for each row execute function public.content_audit('theme');
create trigger themes_slug_history after update of slug on public.themes
  for each row execute function public.content_slug_history_write('theme');

create trigger stories_before_write before insert or update on public.stories
  for each row execute function public.content_before_write('title', 'slug', 'text_local', 'text_standard', 'period');
create trigger stories_audit after insert or update or delete on public.stories
  for each row execute function public.content_audit('story');
create trigger stories_slug_history after update of slug on public.stories
  for each row execute function public.content_slug_history_write('story');
create trigger stories_apply_submission before insert or update on public.stories
  for each row execute function public.content_apply_submission('story');
create trigger customs_before_write before insert or update on public.customs
  for each row execute function public.content_before_write('title', 'slug', 'description', 'period');
create trigger customs_audit after insert or update or delete on public.customs
  for each row execute function public.content_audit('custom');
create trigger customs_slug_history after update of slug on public.customs
  for each row execute function public.content_slug_history_write('custom');
create trigger customs_apply_submission before insert or update on public.customs
  for each row execute function public.content_apply_submission('custom');
create trigger folk_texts_before_write before insert or update on public.folk_texts
  for each row execute function public.content_before_write('title', 'slug', 'text_local', 'text_standard');
create trigger folk_texts_audit after insert or update or delete on public.folk_texts
  for each row execute function public.content_audit('folk_text');
create trigger folk_texts_slug_history after update of slug on public.folk_texts
  for each row execute function public.content_slug_history_write('folk_text');
create trigger folk_texts_apply_submission before insert or update on public.folk_texts
  for each row execute function public.content_apply_submission('folk_text');

-- A Memory yields one Draft in total, whichever kind it becomes: publishing a Draft applies the Memory once (it is
-- approved and its sender credited a single time), so a second row made from it would be left without the credit.
-- BEFORE INSERT OR UPDATE OF source_submission_id on the three kinds.
create function public.intangible_single_draft_check() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.source_submission_id is not null and (
    exists (select 1 from public.stories where source_submission_id = new.source_submission_id and id <> new.id)
    or exists (select 1 from public.customs where source_submission_id = new.source_submission_id and id <> new.id)
    or exists (select 1 from public.folk_texts where source_submission_id = new.source_submission_id and id <> new.id)
  ) then
    raise exception 'Iz ovog sjećanja već je nastao zapis.' using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;
create trigger stories_single_draft before insert or update of source_submission_id on public.stories
  for each row execute function public.intangible_single_draft_check();
create trigger customs_single_draft before insert or update of source_submission_id on public.customs
  for each row execute function public.intangible_single_draft_check();
create trigger folk_texts_single_draft before insert or update of source_submission_id on public.folk_texts
  for each row execute function public.intangible_single_draft_check();

-- Old public slugs of a renamed Story, Custom, Folk text or Theme can redirect.
alter table public.content_slug_history drop constraint content_slug_history_kind_check;
alter table public.content_slug_history add constraint content_slug_history_kind_check check (
  kind in ('area', 'heritage_item', 'word', 'person', 'club', 'story', 'custom', 'folk_text', 'theme')
);

-- Applying a submission (20261103110000_contributions_inbox.sql, plus the widened kinds since): the same function,
-- with one more case. A Memory is applied by publishing the Draft made from it (Story, Custom or Folk text only):
-- the Memory is approved, recorded as applied to that row, and its named, consenting sender is credited.
-- Everything else is exactly as before; in particular a Proposal or Correction still cannot target these kinds.
create or replace function public.content_apply_submission() returns trigger language plpgsql set search_path = '' as $$
declare
  kind text := tg_argv[0];
  explicit_id bigint := new.apply_submission_id;
  want_credit boolean := coalesce(new.apply_credit, true);
  row_json jsonb := to_jsonb(new);
  old_status text := case when tg_op = 'UPDATE' then to_jsonb(old)->>'status' end;
  created_from bigint := nullif(row_json->>'source_submission_id', '')::bigint;
  sid bigint := explicit_id;
  automatic boolean := false;
  sub public.heritage_submissions%rowtype;
  ref uuid;
begin
  new.apply_submission_id := null;
  new.apply_credit := null;

  if explicit_id is not null and tg_op = 'INSERT' then
    raise exception 'Prijedlog se primjenjuje na postojeći zapis.';
  end if;
  -- Publishing a draft that was created from a proposal (or a memory) applies it.
  if sid is null and created_from is not null and row_json->>'status' = 'published'
     and (tg_op = 'INSERT' or old_status is distinct from 'published') then
    sid := created_from;
    automatic := true;
  end if;
  if sid is null then return new; end if;

  select * into sub from public.heritage_submissions where id = sid for update;
  if not found then
    if automatic then return new; end if;
    raise exception 'Prijedlog više ne postoji.';
  end if;
  if sub.applied_at is not null then
    if automatic then return new; end if;
    raise exception 'Prijedlog je već primijenjen.';
  end if;
  if sub.status = 'rejected' then raise exception 'Odbijeni prijedlog se ne može primijeniti.'; end if;
  if not sub.consent_publish then raise exception 'Publication consent required'; end if;

  if sub.type = 'correction' then
    if tg_op <> 'UPDATE' or sub.target_kind is distinct from kind or sub.target_id is null or sub.target_id::text <> row_json->>'id' then
      raise exception 'Ispravak se odnosi na drugi zapis.';
    end if;
  elsif sub.type = 'proposal' then
    if sub.target_kind is distinct from kind or created_from is distinct from sub.id or row_json->>'status' is distinct from 'published' then
      raise exception 'Prijedlog se primjenjuje objavom zapisa nastalog iz njega.';
    end if;
  elsif sub.type = 'memory' then
    if kind not in ('story', 'custom', 'folk_text') or created_from is distinct from sub.id or row_json->>'status' is distinct from 'published' then
      raise exception 'Sjećanje se primjenjuje objavom zapisa nastalog iz njega.';
    end if;
  else
    raise exception 'Primjenjuju se samo ispravci, prijedlozi i sjećanja.';
  end if;

  -- The credit: a named, consenting contributor is thanked once per submission. Sources carry none.
  if want_credit and sub.name is not null and kind <> 'source' then
    ref := gen_random_uuid();
    if kind = 'word' then
      new := jsonb_populate_record(new, jsonb_build_object('entry', jsonb_set(
        row_json->'entry', '{sources}',
        coalesce(row_json->'entry'->'sources', '[]'::jsonb)
          || jsonb_build_array(jsonb_build_object('id', ref, 'kind', 'contribution', 'credit', sub.name)))));
    else
      new := jsonb_populate_record(new, jsonb_build_object('credits',
        coalesce(row_json->'credits', '[]'::jsonb)
          || jsonb_build_array(jsonb_build_object('id', ref, 'name', sub.name, 'kind', sub.type))));
    end if;
  end if;

  update public.heritage_submissions
  set status = 'approved', reviewed_at = now(), applied_at = now(), applied_entity_id = (row_json->>'id')::uuid, credit_ref = ref
  where id = sub.id;
  -- Read (and cleared) by content_audit for exactly this row, so the revision records which submission it applied.
  perform set_config('app.submission_id', (row_json->>'id') || ':' || sub.id, true);
  return new;
end;
$$;

-- Removes the credit a submission added from the live row and from every stored revision of it (as in
-- 20261104020000_clubs.sql), now also for Stories, Customs and Folk texts.
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
  update public.clubs set credits = (
    select coalesce(jsonb_agg(c order by o), '[]'::jsonb) from jsonb_array_elements(credits) with ordinality as t(c, o) where c->>'id' is distinct from ref)
  where id = sub.applied_entity_id and exists (select 1 from jsonb_array_elements(credits) c where c->>'id' = ref);
  update public.stories set credits = (
    select coalesce(jsonb_agg(c order by o), '[]'::jsonb) from jsonb_array_elements(credits) with ordinality as t(c, o) where c->>'id' is distinct from ref)
  where id = sub.applied_entity_id and exists (select 1 from jsonb_array_elements(credits) c where c->>'id' = ref);
  update public.customs set credits = (
    select coalesce(jsonb_agg(c order by o), '[]'::jsonb) from jsonb_array_elements(credits) with ordinality as t(c, o) where c->>'id' is distinct from ref)
  where id = sub.applied_entity_id and exists (select 1 from jsonb_array_elements(credits) c where c->>'id' = ref);
  update public.folk_texts set credits = (
    select coalesce(jsonb_agg(c order by o), '[]'::jsonb) from jsonb_array_elements(credits) with ordinality as t(c, o) where c->>'id' is distinct from ref)
  where id = sub.applied_entity_id and exists (select 1 from jsonb_array_elements(credits) c where c->>'id' = ref);
  update public.heritage_words set entry = jsonb_set(entry, '{sources}', (
    select coalesce(jsonb_agg(s order by o), '[]'::jsonb) from jsonb_array_elements(entry->'sources') with ordinality as t(s, o) where s->>'id' is distinct from ref))
  where id = sub.applied_entity_id::text and exists (select 1 from jsonb_array_elements(entry->'sources') s where s->>'id' = ref);

  update public.content_revisions set data = jsonb_set(data, '{credits}', (
    select coalesce(jsonb_agg(c order by o), '[]'::jsonb) from jsonb_array_elements(data->'credits') with ordinality as t(c, o) where c->>'id' is distinct from ref))
  where entity_id = sub.applied_entity_id
    and entity_kind in ('heritage_item', 'area', 'person', 'club', 'story', 'custom', 'folk_text')
    and jsonb_typeof(data->'credits') = 'array'
    and exists (select 1 from jsonb_array_elements(data->'credits') c where c->>'id' = ref);
  update public.content_revisions set data = jsonb_set(data, '{entry,sources}', (
    select coalesce(jsonb_agg(s order by o), '[]'::jsonb) from jsonb_array_elements(data->'entry'->'sources') with ordinality as t(s, o) where s->>'id' is distinct from ref))
  where entity_id = sub.applied_entity_id and entity_kind = 'word' and jsonb_typeof(data->'entry'->'sources') = 'array'
    and exists (select 1 from jsonb_array_elements(data->'entry'->'sources') s where s->>'id' = ref);
end;
$$;

-- Withdrawal (20261104020000_clubs.sql), now also for Memories: rejecting or deleting a Memory unpublishes the
-- Story, Custom or Folk text made from it and strips its credit, like a Proposal's Draft. A Memory that nothing was
-- made from changes nothing.
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
    update public.clubs set status = 'draft' where source_submission_id = old.id and status = 'published';
  end if;
  if old.type = 'memory' then
    update public.stories set status = 'draft' where source_submission_id = old.id and status = 'published';
    update public.customs set status = 'draft' where source_submission_id = old.id and status = 'published';
    update public.folk_texts set status = 'draft' where source_submission_id = old.id and status = 'published';
  end if;
  if TG_OP = 'DELETE' or old.type in ('proposal', 'memory') then
    perform public.redact_submission_credit(old.id);
  end if;
  return case when TG_OP = 'DELETE' then old else new end;
end;
$$;

-- Server-only access, like every other content table: RLS on, no public grants, service_role only.
do $$
declare t text;
begin
  foreach t in array array[
    'story_types', 'custom_types', 'folk_text_types', 'occasions', 'themes', 'stories', 'customs', 'folk_texts',
    'story_areas', 'story_people', 'story_heritage_items', 'story_themes', 'story_sources',
    'custom_areas', 'custom_people', 'custom_heritage_items', 'custom_themes', 'custom_sources',
    'folk_text_areas', 'folk_text_people', 'folk_text_heritage_items', 'folk_text_themes', 'folk_text_sources', 'folk_text_words'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', t);
    execute format('grant all privileges on table public.%I to service_role', t);
  end loop;
end $$;
-- The date check runs as the writing role (service_role); the trigger function needs no EXECUTE to fire.
revoke all on function public.content_partial_date_valid(text, integer, integer, integer), public.intangible_single_draft_check()
  from public, anon, authenticated;
grant execute on function public.content_partial_date_valid(text, integer, integer, integer) to service_role;
