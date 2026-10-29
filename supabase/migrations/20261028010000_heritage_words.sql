-- WordEntry -> Variant -> AreaUsage, with Area definitions alongside each entry.
-- JSONB keeps one editorial save atomic and preserves the game's existing WordEntry shape.
-- Moderation metadata is outside the public payload and is never returned by the public API.
create table public.heritage_words (
  id text primary key check (char_length(id) between 1 and 200),
  entry jsonb not null check (jsonb_typeof(entry) = 'object' and entry->>'id' = id),
  areas jsonb not null default '[]' check (jsonb_typeof(areas) = 'array'),
  active boolean not null default false,
  submission_id bigint unique references public.heritage_submissions(id) on delete set null,
  submission_place text check (char_length(submission_place) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint heritage_word_model_fields check (
    entry ?& array['id', 'headword', 'meaning', 'status', 'variants', 'sources']
    and jsonb_typeof(entry->'id') = 'string'
    and jsonb_typeof(entry->'headword') = 'string'
    and jsonb_typeof(entry->'status') = 'string'
    and jsonb_typeof(entry->'meaning') = 'object'
    and entry->'meaning' ? 'hr'
    and jsonb_typeof(entry->'meaning'->'hr') = 'string'
    and jsonb_typeof(entry->'variants') = 'array'
    and jsonb_typeof(entry->'sources') = 'array'
  ),
  constraint heritage_word_status check (entry->>'status' in ('placeholder', 'community', 'verified')),
  constraint heritage_word_payload_size check (octet_length(entry::text) + octet_length(areas::text) <= 131072),
  constraint heritage_active_word_fields check (not active or (
    coalesce(char_length(btrim(entry->>'headword')), 0) > 0
    and coalesce(char_length(btrim(entry->'meaning'->>'hr')), 0) > 0
    and coalesce(char_length(btrim(entry->>'partOfSpeech')), 0) > 0
    and jsonb_typeof(entry->'variants') = 'array'
    and jsonb_array_length(entry->'variants') > 0
    and entry->'variants'->0->>'form' = entry->>'headword'
    and jsonb_typeof(entry->'sources') = 'array'
    and jsonb_array_length(entry->'sources') > 0
  ))
);
create index heritage_words_active_id on public.heritage_words (active, id);
alter table public.heritage_words enable row level security;
revoke all privileges on table public.heritage_words from anon, authenticated, public;
grant all privileges on table public.heritage_words to service_role;

-- Approval and activation share the same transaction; a failed save approves nothing.
create function public.heritage_word_before_save() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.active and (TG_OP = 'INSERT' or not old.active) and new.submission_id is not null then
    update public.heritage_submissions set status = 'approved', reviewed_at = now()
      where id = new.submission_id and consent_publish;
    if not found then raise exception 'Publication consent required'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.heritage_word_before_save() from public, anon, authenticated;
create trigger heritage_word_before_save before insert or update on public.heritage_words
  for each row execute function public.heritage_word_before_save();

-- Existing visibly labelled samples only; no visitor submissions are seeded or activated.
insert into public.heritage_words (id, entry, areas, active) values ('hiza', '{"id":"hiza","headword":"hiža","meaning":{"hr":"kuća","en":"house"},"partOfSpeech":"imenica, ž. r.","status":"placeholder","sources":[{"id":"sample","kind":"editor","credit":"uzorak, nije provjereno"}],"variants":[{"id":"hiza~hiza","form":"hiža","status":"placeholder","usages":[{"areaId":"hr-kkz-sveti-petar-orehovec","confidence":"reported","note":"primjer"},{"areaId":"hr-kkz-krizevci","confidence":"reported","note":"primjer"}]},{"id":"hiza~iza","form":"iža","status":"placeholder","usages":[{"areaId":"hr-kkz-sveti-petar-orehovec","confidence":"reported","note":"primjer"}]},{"id":"hiza~hisa","form":"hiša","status":"placeholder","usages":[{"areaId":"hr-kkz-krizevci","confidence":"reported","note":"primjer"}]}]}'::jsonb, '[{"id":"hr","name":"Hrvatska","kind":"country","parentId":null},{"id":"hr-kkz","name":"Koprivničko-križevačka županija","kind":"county","parentId":"hr"},{"id":"hr-kkz-krizevci","name":"Križevci","kind":"town","parentId":"hr-kkz"},{"id":"hr-kkz-sveti-petar-orehovec","name":"Sveti Petar Orehovec","kind":"municipality","parentId":"hr-kkz"}]'::jsonb, true);
insert into public.heritage_words (id, entry, areas, active) values ('kaj', '{"id":"kaj","headword":"kaj","meaning":{"hr":"što","en":"what"},"partOfSpeech":"zamjenica","examples":[{"text":"Kaj delaš?","translation":"Što radiš?"}],"status":"placeholder","sources":[{"id":"sample","kind":"editor","credit":"uzorak, nije provjereno"}],"variants":[{"id":"kaj~kaj","form":"kaj","status":"placeholder","usages":[{"areaId":"hr-kkz-sveti-petar-orehovec","confidence":"reported","note":"primjer"},{"areaId":"hr-kkz-krizevci","confidence":"reported","note":"primjer"}]},{"id":"kaj~kej","form":"kej","status":"placeholder","usages":[{"areaId":"hr-kkz-sveti-petar-orehovec","confidence":"reported","note":"primjer"}]}]}'::jsonb, '[{"id":"hr","name":"Hrvatska","kind":"country","parentId":null},{"id":"hr-kkz","name":"Koprivničko-križevačka županija","kind":"county","parentId":"hr"},{"id":"hr-kkz-krizevci","name":"Križevci","kind":"town","parentId":"hr-kkz"},{"id":"hr-kkz-sveti-petar-orehovec","name":"Sveti Petar Orehovec","kind":"municipality","parentId":"hr-kkz"}]'::jsonb, true);
insert into public.heritage_words (id, entry, areas, active) values ('vura', '{"id":"vura","headword":"vura","meaning":{"hr":"sat","en":"clock"},"partOfSpeech":"imenica, ž. r.","status":"placeholder","sources":[{"id":"sample","kind":"editor","credit":"uzorak, nije provjereno"}],"variants":[{"id":"vura~vura","form":"vura","status":"placeholder","usages":[{"areaId":"hr-kkz-sveti-petar-orehovec","confidence":"reported","note":"primjer"},{"areaId":"hr-kkz-krizevci","confidence":"reported","note":"primjer"}]},{"id":"vura~ura","form":"ura","status":"placeholder","usages":[{"areaId":"hr-kkz-krizevci","confidence":"reported","note":"primjer"}]}]}'::jsonb, '[{"id":"hr","name":"Hrvatska","kind":"country","parentId":null},{"id":"hr-kkz","name":"Koprivničko-križevačka županija","kind":"county","parentId":"hr"},{"id":"hr-kkz-krizevci","name":"Križevci","kind":"town","parentId":"hr-kkz"},{"id":"hr-kkz-sveti-petar-orehovec","name":"Sveti Petar Orehovec","kind":"municipality","parentId":"hr-kkz"}]'::jsonb, true);
insert into public.heritage_words (id, entry, areas, active) values ('zdenec', '{"id":"zdenec","headword":"zdenec","meaning":{"hr":"bunar","en":"well"},"partOfSpeech":"imenica, m. r.","status":"placeholder","sources":[{"id":"sample","kind":"editor","credit":"uzorak, nije provjereno"}],"variants":[{"id":"zdenec~zdenec","form":"zdenec","status":"placeholder","usages":[{"areaId":"hr-kkz-sveti-petar-orehovec","confidence":"reported","note":"primjer"},{"areaId":"hr-kkz-krizevci","confidence":"reported","note":"primjer"}]},{"id":"zdenec~zdenc","form":"zdenc","status":"placeholder","usages":[{"areaId":"hr-kkz-sveti-petar-orehovec","confidence":"reported","note":"primjer"}]},{"id":"zdenec~zdenac","form":"zdenac","status":"placeholder","usages":[{"areaId":"hr-kkz-krizevci","confidence":"reported","note":"primjer"}]}]}'::jsonb, '[{"id":"hr","name":"Hrvatska","kind":"country","parentId":null},{"id":"hr-kkz","name":"Koprivničko-križevačka županija","kind":"county","parentId":"hr"},{"id":"hr-kkz-krizevci","name":"Križevci","kind":"town","parentId":"hr-kkz"},{"id":"hr-kkz-sveti-petar-orehovec","name":"Sveti Petar Orehovec","kind":"municipality","parentId":"hr-kkz"}]'::jsonb, true);
insert into public.heritage_words (id, entry, areas, active) values ('fertun', '{"id":"fertun","headword":"fertun","meaning":{"hr":"pregača","en":"apron"},"partOfSpeech":"imenica, m. r.","status":"placeholder","sources":[{"id":"sample","kind":"editor","credit":"uzorak, nije provjereno"}],"variants":[{"id":"fertun~fertun","form":"fertun","status":"placeholder","usages":[{"areaId":"hr-kkz-sveti-petar-orehovec","confidence":"reported","note":"primjer"}]},{"id":"fertun~firtun","form":"firtun","status":"placeholder","usages":[{"areaId":"hr-kkz-sveti-petar-orehovec","confidence":"reported","note":"primjer"}]},{"id":"fertun~fertuh","form":"fertuh","status":"placeholder","usages":[{"areaId":"hr-kkz-krizevci","confidence":"reported","note":"primjer"}]}]}'::jsonb, '[{"id":"hr","name":"Hrvatska","kind":"country","parentId":null},{"id":"hr-kkz","name":"Koprivničko-križevačka županija","kind":"county","parentId":"hr"},{"id":"hr-kkz-krizevci","name":"Križevci","kind":"town","parentId":"hr-kkz"},{"id":"hr-kkz-sveti-petar-orehovec","name":"Sveti Petar Orehovec","kind":"municipality","parentId":"hr-kkz"}]'::jsonb, true);
insert into public.heritage_words (id, entry, areas, active) values ('lajbek', '{"id":"lajbek","headword":"lajbek","meaning":{"hr":"prsluk","en":"waistcoat"},"partOfSpeech":"imenica, m. r.","status":"placeholder","sources":[{"id":"sample","kind":"editor","credit":"uzorak, nije provjereno"}],"variants":[{"id":"lajbek~lajbek","form":"lajbek","status":"placeholder","usages":[{"areaId":"hr-kkz-sveti-petar-orehovec","confidence":"reported","note":"primjer"},{"areaId":"hr-kkz-krizevci","confidence":"reported","note":"primjer"}]},{"id":"lajbek~lajbec","form":"lajbec","status":"placeholder","usages":[{"areaId":"hr-kkz-sveti-petar-orehovec","confidence":"reported","note":"primjer"}]}]}'::jsonb, '[{"id":"hr","name":"Hrvatska","kind":"country","parentId":null},{"id":"hr-kkz","name":"Koprivničko-križevačka županija","kind":"county","parentId":"hr"},{"id":"hr-kkz-krizevci","name":"Križevci","kind":"town","parentId":"hr-kkz"},{"id":"hr-kkz-sveti-petar-orehovec","name":"Sveti Petar Orehovec","kind":"municipality","parentId":"hr-kkz"}]'::jsonb, true);
insert into public.heritage_words (id, entry, areas, active) values ('skrlak', '{"id":"skrlak","headword":"škrlak","meaning":{"hr":"šešir","en":"hat"},"partOfSpeech":"imenica, m. r.","status":"placeholder","sources":[{"id":"sample","kind":"editor","credit":"uzorak, nije provjereno"}],"variants":[{"id":"skrlak~skrlak","form":"škrlak","status":"placeholder","usages":[{"areaId":"hr-kkz-krizevci","confidence":"reported","note":"primjer"}]},{"id":"skrlak~skrljak","form":"škrljak","status":"placeholder","usages":[{"areaId":"hr-kkz-sveti-petar-orehovec","confidence":"reported","note":"primjer"}]}]}'::jsonb, '[{"id":"hr","name":"Hrvatska","kind":"country","parentId":null},{"id":"hr-kkz","name":"Koprivničko-križevačka županija","kind":"county","parentId":"hr"},{"id":"hr-kkz-krizevci","name":"Križevci","kind":"town","parentId":"hr-kkz"},{"id":"hr-kkz-sveti-petar-orehovec","name":"Sveti Petar Orehovec","kind":"municipality","parentId":"hr-kkz"}]'::jsonb, true);
insert into public.heritage_words (id, entry, areas, active) values ('cuker', '{"id":"cuker","headword":"cuker","meaning":{"hr":"šećer","en":"sugar"},"partOfSpeech":"imenica, m. r.","status":"placeholder","sources":[{"id":"sample","kind":"editor","credit":"uzorak, nije provjereno"}],"variants":[{"id":"cuker~cuker","form":"cuker","status":"placeholder","usages":[{"areaId":"hr-kkz-sveti-petar-orehovec","confidence":"reported","note":"primjer"},{"areaId":"hr-kkz-krizevci","confidence":"reported","note":"primjer"}]},{"id":"cuker~cukor","form":"cukor","status":"placeholder","usages":[{"areaId":"hr-kkz-krizevci","confidence":"reported","note":"primjer"}]}]}'::jsonb, '[{"id":"hr","name":"Hrvatska","kind":"country","parentId":null},{"id":"hr-kkz","name":"Koprivničko-križevačka županija","kind":"county","parentId":"hr"},{"id":"hr-kkz-krizevci","name":"Križevci","kind":"town","parentId":"hr-kkz"},{"id":"hr-kkz-sveti-petar-orehovec","name":"Sveti Petar Orehovec","kind":"municipality","parentId":"hr-kkz"}]'::jsonb, true);
insert into public.heritage_words (id, entry, areas, active) values ('denes', '{"id":"denes","headword":"denes","meaning":{"hr":"danas","en":"today"},"partOfSpeech":"prilog","status":"placeholder","sources":[{"id":"sample","kind":"editor","credit":"uzorak, nije provjereno"}],"variants":[{"id":"denes~denes","form":"denes","status":"placeholder","usages":[{"areaId":"hr-kkz-sveti-petar-orehovec","confidence":"reported","note":"primjer"}]},{"id":"denes~danes","form":"danes","status":"placeholder","usages":[{"areaId":"hr-kkz-krizevci","confidence":"reported","note":"primjer"}]}]}'::jsonb, '[{"id":"hr","name":"Hrvatska","kind":"country","parentId":null},{"id":"hr-kkz","name":"Koprivničko-križevačka županija","kind":"county","parentId":"hr"},{"id":"hr-kkz-krizevci","name":"Križevci","kind":"town","parentId":"hr-kkz"},{"id":"hr-kkz-sveti-petar-orehovec","name":"Sveti Petar Orehovec","kind":"municipality","parentId":"hr-kkz"}]'::jsonb, true);
