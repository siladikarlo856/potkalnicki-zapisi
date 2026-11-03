-- Corrections and proposals inbox (PR 12 of the content admin plan).
-- Expand-only and compatible with the running app: the new columns are nullable or defaulted, the type
-- list only grows, and the old app ignores all of it. Apply before deploying the matching app.
--
-- * heritage_submissions gets 'proposal' as a type and the structured target of a correction or proposal
--   (target_kind + target_id, a payload of proposed fields, the revision the sender saw, a duplicate
--   fingerprint, and where the submission was applied).
-- * Rows created from a proposal (heritage_items, areas, sources) point back at it with
--   source_submission_id, as heritage_words.submission_id already does.
-- * Applying a submission is atomic. The row write carries a transient apply_submission_id (and
--   apply_credit); a BEFORE trigger checks consent and the target, approves the submission, records
--   where it was applied, adds the contributor credit, and hands the id to the audit trigger so the
--   revision row is attributed to the submission. Publishing a draft that was created from a proposal
--   applies that proposal the same way, without the transient column.
-- * Withdrawing a submission (reject or delete) unpublishes what a proposal created and strips the credit
--   it added, including from the revision snapshots (redact_submission_credit).

alter table public.heritage_submissions
  drop constraint heritage_submissions_type_check,
  add constraint heritage_submissions_type_check check (
    type is null or type in ('word', 'expression', 'memory', 'other', 'correction', 'proposal')
  );

alter table public.heritage_submissions
  add column target_kind text check (target_kind in ('word', 'heritage_item', 'area', 'source')),
  -- A UUID for every kind; words store theirs as UUID text, so a word target is read as id = target_id::text.
  add column target_id uuid,
  add column payload jsonb check (payload is null or (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 16384)),
  add column base_revision integer check (base_revision >= 1),
  add column applied_at timestamptz,
  add column applied_entity_id uuid,
  -- The id of the credit entry this submission added to public content; strips and redacts it again on withdrawal.
  add column credit_ref uuid,
  add column fingerprint text check (fingerprint ~ '^[a-f0-9]{64}$');

alter table public.heritage_submissions
  add constraint heritage_submissions_target_shape check (
    coalesce(type in ('correction', 'proposal'), false) = (target_kind is not null)
    and (type is distinct from 'proposal' or (target_id is null and payload is not null))
  ),
  add constraint heritage_submissions_applied_shape check ((applied_at is null) = (applied_entity_id is null));

-- Existing heritage item corrections: resolve the atlas id they were sent with. A correction whose item is
-- gone keeps target_id null (the inbox shows it as unknown); target_ref still holds the original id.
update public.heritage_submissions s
set target_kind = 'heritage_item',
    target_id = coalesce(
      (select l.entity_id from public.content_legacy_ids l where l.kind = 'heritage_item' and l.legacy_id = s.target_ref),
      case when s.target_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then s.target_ref::uuid end)
where s.type = 'correction' and s.target_kind is null;

create index heritage_submissions_target on public.heritage_submissions (target_kind, target_id) where target_id is not null;
create index heritage_submissions_fingerprint on public.heritage_submissions (fingerprint, created_at) where fingerprint is not null;

comment on column public.heritage_submissions.target_kind is 'Content kind a correction or proposal is about: word, heritage_item, area or source.';
comment on column public.heritage_submissions.target_id is 'Entity a correction changes (UUID); null for proposals and for legacy corrections whose item no longer exists.';
comment on column public.heritage_submissions.payload is 'Whitelisted proposed fields (corrections: only the changed ones; proposals: the new row).';
comment on column public.heritage_submissions.base_revision is 'Revision of the target when the correction was sent, to warn that it changed since.';
comment on column public.heritage_submissions.credit_ref is 'Id of the credit entry added to the applied row; see redact_submission_credit.';

-- Rows created from a proposal, and the transient columns an apply travels in. credits is new on areas
-- (heritage_items has it already; words keep credits as contribution sources inside the entry).
alter table public.areas
  add column credits jsonb not null default '[]' check (jsonb_typeof(credits) = 'array' and octet_length(credits::text) <= 8192);
alter table public.areas
  add column source_submission_id bigint unique references public.heritage_submissions(id) on delete set null,
  add column apply_submission_id bigint,
  add column apply_credit boolean;
alter table public.heritage_items
  add column source_submission_id bigint unique references public.heritage_submissions(id) on delete set null,
  add column apply_submission_id bigint,
  add column apply_credit boolean;
alter table public.sources
  add column source_submission_id bigint unique references public.heritage_submissions(id) on delete set null,
  add column apply_submission_id bigint,
  add column apply_credit boolean;
alter table public.heritage_words
  add column apply_submission_id bigint,
  add column apply_credit boolean;

comment on column public.heritage_items.apply_submission_id is
  'Transient: set by the API on a write that applies a submission; the trigger clears it, so it is always null when stored.';
comment on column public.heritage_items.apply_credit is 'Transient, like apply_submission_id: false leaves the contributor out of the credits.';

-- BEFORE INSERT OR UPDATE on heritage_items, areas, sources, heritage_words. Argument: the content kind.
create function public.content_apply_submission() returns trigger language plpgsql set search_path = '' as $$
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
  -- Publishing a draft that was created from a proposal applies that proposal.
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
  else
    raise exception 'Primjenjuju se samo ispravci i prijedlozi.';
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

create trigger heritage_items_apply_submission before insert or update on public.heritage_items
  for each row execute function public.content_apply_submission('heritage_item');
create trigger areas_apply_submission before insert or update on public.areas
  for each row execute function public.content_apply_submission('area');
create trigger sources_apply_submission before insert or update on public.sources
  for each row execute function public.content_apply_submission('source');
create trigger heritage_words_apply_submission before insert or update on public.heritage_words
  for each row execute function public.content_apply_submission('word');

-- Same as before, plus: the applying submission (see above) is recorded on the revision, and the transient
-- columns never reach the snapshot. Create or replace keeps the existing grants.
create or replace function public.content_audit() returns trigger language plpgsql set search_path = '' as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  pending text := nullif(current_setting('app.submission_id', true), '');
  applied bigint;
begin
  if pending is not null and split_part(pending, ':', 1) = rec->>'id' then
    applied := split_part(pending, ':', 2)::bigint;
    perform set_config('app.submission_id', '', true);
  end if;
  insert into public.content_revisions (entity_kind, entity_id, revision, action, data, submission_id, actor)
  values (tg_argv[0], (rec->>'id')::uuid,
    case when tg_op = 'DELETE' then old.revision + 1 else new.revision end,
    lower(tg_op), rec - 'search_text' - 'apply_submission_id' - 'apply_credit', applied,
    coalesce(nullif(current_setting('app.actor', true), ''), 'admin'));
  return null;
end;
$$;

-- Removes the credit a submission added from the live row and from every stored revision of it. A revision
-- snapshot keeps a copy of the row, so without this the name would outlive the withdrawn consent.
create function public.redact_submission_credit(p_submission_id bigint) returns void language plpgsql set search_path = '' as $$
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
  update public.heritage_words set entry = jsonb_set(entry, '{sources}', (
    select coalesce(jsonb_agg(s order by o), '[]'::jsonb) from jsonb_array_elements(entry->'sources') with ordinality as t(s, o) where s->>'id' is distinct from ref))
  where id = sub.applied_entity_id::text and exists (select 1 from jsonb_array_elements(entry->'sources') s where s->>'id' = ref);

  update public.content_revisions set data = jsonb_set(data, '{credits}', (
    select coalesce(jsonb_agg(c order by o), '[]'::jsonb) from jsonb_array_elements(data->'credits') with ordinality as t(c, o) where c->>'id' is distinct from ref))
  where entity_id = sub.applied_entity_id and entity_kind in ('heritage_item', 'area') and jsonb_typeof(data->'credits') = 'array'
    and exists (select 1 from jsonb_array_elements(data->'credits') c where c->>'id' = ref);
  update public.content_revisions set data = jsonb_set(data, '{entry,sources}', (
    select coalesce(jsonb_agg(s order by o), '[]'::jsonb) from jsonb_array_elements(data->'entry'->'sources') with ordinality as t(s, o) where s->>'id' is distinct from ref))
  where entity_id = sub.applied_entity_id and entity_kind = 'word' and jsonb_typeof(data->'entry'->'sources') = 'array'
    and exists (select 1 from jsonb_array_elements(data->'entry'->'sources') s where s->>'id' = ref);
  -- credit_ref stays: this also runs from a BEFORE DELETE trigger, where changing the submission's own row
  -- would silently cancel the delete, and a second pass finds nothing to strip.
end;
$$;

-- The existing withdrawal (words created from a submission are deactivated) now also covers proposals:
-- rejecting or deleting one unpublishes the rows it created and strips its credit. Deleting an applied
-- correction strips its credit too but keeps the editorial change; the revision's submission_id is set
-- null by its foreign key. A reject of anything else behaves as before.
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
  end if;
  if TG_OP = 'DELETE' or old.type = 'proposal' then
    perform public.redact_submission_credit(old.id);
  end if;
  return case when TG_OP = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.content_apply_submission(), public.redact_submission_credit(bigint) from public, anon, authenticated;
grant execute on function public.redact_submission_credit(bigint) to service_role;
