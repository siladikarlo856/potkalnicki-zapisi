-- Daily word (Riječ dana) schedule. Additive: the running app does not know this table.
-- One row per Europe/Zagreb calendar day. A row is either an admin pin for a future day
-- (unresolved, snapshot is null) or the resolved word for a day with a frozen snapshot of
-- the options and clues. Only the Node server (service_role) reads or writes it.
create table public.heritage_daily_words (
  day date primary key,
  word_id text not null references public.heritage_words(id),
  source text not null check (source in ('pinned', 'auto')),
  village text not null default 'auto' check (char_length(village) between 1 and 200),
  snapshot jsonb check (snapshot is null or (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 16384)),
  resolved_at timestamptz,
  replaced_word_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((snapshot is null) = (resolved_at is null))
);
create index heritage_daily_words_word on public.heritage_daily_words (word_id, day desc);

alter table public.heritage_daily_words enable row level security;
revoke all privileges on table public.heritage_daily_words from public, anon, authenticated;
grant all privileges on table public.heritage_daily_words to service_role;

-- A resolved day is what everyone saw, so it is append-only apart from one audited path:
-- a withdrawn word is replaced, the old id is appended to replaced_word_ids and a new
-- snapshot is written. Everything else on a resolved row is frozen.
create function public.heritage_daily_word_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.resolved_at is not null then raise exception 'Resolved daily word cannot be deleted'; end if;
    return old;
  end if;
  if new.day <> old.day and old.resolved_at is not null then raise exception 'Resolved daily word cannot move to another day'; end if;
  if new.created_at <> old.created_at then raise exception 'created_at is immutable'; end if;
  if old.resolved_at is not null then
    if new.resolved_at is null or new.snapshot is null then raise exception 'Resolved daily word cannot be unresolved'; end if;
    if new.word_id <> old.word_id then
      if new.replaced_word_ids is distinct from (old.replaced_word_ids || old.word_id) or new.snapshot is not distinct from old.snapshot then
        raise exception 'A resolved daily word can only be replaced with an audited new snapshot';
      end if;
    elsif new.snapshot is distinct from old.snapshot or new.replaced_word_ids is distinct from old.replaced_word_ids or new.resolved_at <> old.resolved_at then
      raise exception 'Resolved daily word snapshot is immutable';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.heritage_daily_word_guard() from public, anon, authenticated;
create trigger heritage_daily_word_guard before update or delete on public.heritage_daily_words
for each row execute function public.heritage_daily_word_guard();
