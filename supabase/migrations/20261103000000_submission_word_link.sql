-- Contributions from the daily word: a submission can point at the word it concerns and say whether
-- it is a local form ('variant') or a confirmation that the word is used in the sender's place ('usage').
-- Additive and nullable: the running app ignores both columns, so apply before deploying the matching app.
-- word_id is text because heritage_words.id is text. The withdrawal trigger only touches words created
-- *from* a submission, so deleting a usage confirmation never deactivates the word it points at.
alter table public.heritage_submissions
  add column word_id text references public.heritage_words(id) on delete set null,
  add column intent text check (intent in ('variant', 'usage')),
  add constraint heritage_submissions_intent_word check (intent is null or word_id is not null);

comment on column public.heritage_submissions.word_id is
  'Word the submission concerns (daily word contributions); null for ordinary submissions.';
comment on column public.heritage_submissions.intent is
  'variant = local form for word_id; usage = the sender says word_id is used in their place. Requires word_id.';

create function public.heritage_words_unlink_submissions() returns trigger language plpgsql set search_path = '' as $$
begin
  update public.heritage_submissions set word_id = null, intent = null where word_id = old.id;
  return old;
end;
$$;
revoke all on function public.heritage_words_unlink_submissions() from public, anon, authenticated;

create trigger heritage_words_unlink_submissions before delete on public.heritage_words
  for each row execute function public.heritage_words_unlink_submissions();
