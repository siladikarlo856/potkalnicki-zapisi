-- Deliberately later than the pending 20261030000000_submission_places migration.
-- Only the Node server may call this API. All progress/expiry mutations share a row lock.
create table public.heritage_challenges (
  code text primary key check (code ~ '^[A-Za-z0-9_-]{16,32}$'),
  content jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 262144),
  created_at timestamptz not null default now(),
  closes_at timestamptz not null default (now() + interval '7 days'),
  max_closes_at timestamptz not null default (now() + interval '30 days'),
  check (max_closes_at = created_at + interval '30 days'),
  check (closes_at >= created_at + interval '7 days' and closes_at <= max_closes_at)
);
create table public.heritage_challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_code text not null references public.heritage_challenges(code),
  nickname text not null check (char_length(nickname) between 2 and 24 and nickname = btrim(nickname)),
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  phase text not null default 'ready' check (phase in ('ready', 'question', 'feedback', 'round', 'finished')),
  question_index integer not null default 0 check (question_index >= 0),
  total_score integer not null default 0 check (total_score >= 0),
  completed_at timestamptz,
  unique (challenge_code, token_hash)
);
create unique index heritage_challenge_nickname on public.heritage_challenge_participants (challenge_code, lower(nickname));
create index heritage_challenge_scores on public.heritage_challenge_participants (challenge_code, total_score desc) where completed_at is not null;
create table public.heritage_challenge_answers (
  participant_id uuid not null references public.heritage_challenge_participants(id),
  question_index integer not null check (question_index >= 0),
  revealed_at timestamptz not null default now(),
  selected integer check (selected between 0 and 3),
  answered_at timestamptz,
  correct boolean,
  points integer check (points in (0, 100)),
  primary key (participant_id, question_index),
  check ((answered_at is null and selected is null and correct is null and points is null)
    or (answered_at is not null and correct is not null and points is not null and points = case when correct then 100 else 0 end))
);

alter table public.heritage_challenges enable row level security;
alter table public.heritage_challenge_participants enable row level security;
alter table public.heritage_challenge_answers enable row level security;
revoke all on public.heritage_challenges, public.heritage_challenge_participants, public.heritage_challenge_answers from public, anon, authenticated;
grant all on public.heritage_challenges, public.heritage_challenge_participants, public.heritage_challenge_answers to service_role;

create function public.heritage_challenge_snapshot_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.content is distinct from old.content or new.code <> old.code or new.created_at <> old.created_at or new.max_closes_at <> old.max_closes_at then
    raise exception 'Challenge snapshot is immutable';
  end if;
  return new;
end;
$$;
create trigger heritage_challenge_snapshot_guard before update on public.heritage_challenges
for each row execute function public.heritage_challenge_snapshot_guard();

create function public.heritage_challenge_answer_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then raise exception 'Answers are immutable'; end if;
  if old.answered_at is not null or new.participant_id <> old.participant_id or new.question_index <> old.question_index or new.revealed_at <> old.revealed_at then
    raise exception 'Answers are immutable';
  end if;
  return new;
end;
$$;
create trigger heritage_challenge_answer_guard before update or delete on public.heritage_challenge_answers
for each row execute function public.heritage_challenge_answer_guard();

-- Flatten only on the trusted side. Neither this helper nor the snapshot is public.
create function public.heritage_challenge_questions(content jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_agg(q.value || jsonb_build_object('round', r.ordinality - 1, 'number', q.ordinality)
    order by r.ordinality, q.ordinality)
  from jsonb_array_elements(content->'rounds') with ordinality r
  cross join lateral jsonb_array_elements(r.value->'questions') with ordinality q;
$$;

create function public.heritage_challenge_state(p_code text, p_hash text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  c public.heritage_challenges;
  p public.heritage_challenge_participants;
  a public.heritage_challenge_answers;
  questions jsonb;
  q jsonb;
  rounds jsonb;
  results jsonb;
  target integer;
begin
  select * into c from public.heritage_challenges where code = p_code;
  if not found then raise sqlstate 'PT404' using message = 'Challenge not found'; end if;
  select * into p from public.heritage_challenge_participants where challenge_code = p_code and token_hash = p_hash;
  questions := public.heritage_challenge_questions(c.content);
  select jsonb_agg(jsonb_build_object('topic', r.value->'topic', 'count', jsonb_array_length(r.value->'questions')) order by r.ordinality)
    into rounds from jsonb_array_elements(c.content->'rounds') with ordinality r;
  select max(total_score) into target from public.heritage_challenge_participants where challenge_code = p_code and completed_at is not null;
  if p.id is not null then
    select jsonb_agg(jsonb_build_object('topic', r.value->'topic', 'count', jsonb_array_length(r.value->'questions'),
      'answered', (select count(*) from public.heritage_challenge_answers stored where stored.participant_id = p.id and stored.answered_at is not null and (questions->stored.question_index->>'round')::integer = r.ordinality - 1),
      'score', (select coalesce(sum(stored.points), 0) from public.heritage_challenge_answers stored where stored.participant_id = p.id and (questions->stored.question_index->>'round')::integer = r.ordinality - 1)) order by r.ordinality)
      into results from jsonb_array_elements(c.content->'rounds') with ordinality r;
    if p.phase in ('question', 'feedback') then
      q := questions->p.question_index;
      select * into a from public.heritage_challenge_answers where participant_id = p.id and question_index = p.question_index;
    end if;
  end if;
  return jsonb_build_object(
    'code', c.code, 'title', c.content->'title', 'sample', c.content->'sample',
    'createdAt', c.created_at, 'closesAt', c.closes_at, 'closed', clock_timestamp() >= c.closes_at,
    'rounds', rounds, 'questionCount', jsonb_array_length(questions), 'maxScore', jsonb_array_length(questions) * 100, 'targetScore', target,
    'participant', case when p.id is not null then jsonb_build_object('nickname', p.nickname, 'phase', p.phase, 'index', p.question_index,
      'total', p.total_score, 'completedAt', p.completed_at, 'rounds', results) end,
    'question', case when q is not null then jsonb_build_object('id', q->'id', 'prompt', q->'prompt', 'options', q->'options', 'round', q->'round', 'number', q->'number') end,
    'feedback', case when a.answered_at is not null then jsonb_build_object('selected', a.selected, 'correct', q->'correct', 'points', a.points, 'explanation', q->'explanation') end
  );
end;
$$;

-- Invoker security: only service_role has EXECUTE and table privileges. Public callers
-- cannot choose a token hash or read the content via PostgREST.
create function public.heritage_challenge_action(p_action text, p_code text, p_hash text default null, p_input jsonb default '{}') returns jsonb
language plpgsql set search_path = '' as $$
declare
  c public.heritage_challenges;
  p public.heritage_challenge_participants;
  questions jsonb;
  q jsonb;
  instant timestamptz;
  nickname text;
  choice integer;
  earned integer;
begin
  if p_action = 'create' then
    instant := clock_timestamp();
    insert into public.heritage_challenges (code, content, created_at, closes_at, max_closes_at)
      values (p_code, p_input->'content', instant, instant + interval '7 days', instant + interval '30 days');
  end if;
  -- Lock the challenge first in every mutation, including competing completions. Reads stay lock-free.
  if p_action = 'state' then
    select * into c from public.heritage_challenges where code = p_code;
  else
    select * into c from public.heritage_challenges where code = p_code for update;
  end if;
  if not found then raise sqlstate 'PT404' using message = 'Challenge not found'; end if;
  instant := clock_timestamp();
  if p_action = 'state' then return public.heritage_challenge_state(p_code, p_hash); end if;
  if p_action in ('create', 'join', 'reveal', 'answer') and instant >= c.closes_at then
    raise sqlstate 'PT410' using message = 'Challenge closed';
  end if;
  select * into p from public.heritage_challenge_participants where challenge_code = p_code and token_hash = p_hash for update;
  if p_action in ('create', 'join') then
    if p.id is null then
      nickname := p_input->>'nickname';
      if nickname is null or char_length(nickname) not between 2 and 24 or nickname <> btrim(nickname) or nickname !~ '^[[:alnum:]][[:alnum:] ._''-]*$' then
        raise sqlstate 'PT400' using message = 'Invalid nickname';
      end if;
      begin
        insert into public.heritage_challenge_participants (challenge_code, nickname, token_hash) values (p_code, nickname, p_hash);
      exception when unique_violation then
        raise sqlstate 'PT409' using message = 'Nickname taken';
      end;
    end if;
    return public.heritage_challenge_state(p_code, p_hash);
  end if;
  if p.id is null then raise sqlstate 'PT401' using message = 'Join this challenge first'; end if;
  questions := public.heritage_challenge_questions(c.content);
  q := questions->p.question_index;
  if p_action = 'reveal' then
    if p.phase = 'ready' then
      insert into public.heritage_challenge_answers (participant_id, question_index, revealed_at) values (p.id, p.question_index, instant);
      update public.heritage_challenge_participants set phase = 'question' where id = p.id;
    elsif p.phase <> 'question' then raise sqlstate 'PT409' using message = 'Continue before revealing a question';
    end if;
  elsif p_action = 'answer' then
    if p.phase <> 'question' or p_input->>'questionId' is distinct from q->>'id' then
      raise sqlstate 'PT409' using message = 'Answer already submitted or question not current';
    end if;
    if p_input->'selected' <> 'null'::jsonb and (jsonb_typeof(p_input->'selected') <> 'number' or p_input->>'selected' !~ '^[0-3]$') then
      raise sqlstate 'PT400' using message = 'Invalid answer';
    end if;
    choice := (p_input->>'selected')::integer;
    earned := case when choice = (q->>'correct')::integer then 100 else 0 end;
    update public.heritage_challenge_answers set selected = choice, answered_at = instant, points = earned, correct = earned = 100
      where participant_id = p.id and question_index = p.question_index and answered_at is null;
    if not found then raise sqlstate 'PT409' using message = 'Answer already submitted'; end if;
    update public.heritage_challenge_participants set phase = 'feedback', total_score = total_score + earned,
      completed_at = case when question_index = jsonb_array_length(questions) - 1 then instant end where id = p.id;
    if p.question_index = jsonb_array_length(questions) - 1 then
      update public.heritage_challenges set closes_at = least(max_closes_at, greatest(closes_at, instant + interval '3 days')) where code = p_code;
    end if;
  elsif p_action = 'continue' then
    -- A stale duplicate Continue cannot skip the next question or a round summary.
    if p_input->>'phase' is distinct from p.phase or p_input->>'index' is distinct from p.question_index::text then
      raise sqlstate 'PT409' using message = 'Progress changed; refresh';
    end if;
    if p.phase = 'feedback' then
      update public.heritage_challenge_participants set question_index = question_index + 1,
        phase = case when questions->(p.question_index + 1) is null or questions->(p.question_index + 1)->>'round' <> q->>'round' then 'round' else 'ready' end where id = p.id;
    elsif p.phase = 'round' then
      update public.heritage_challenge_participants set phase = case when completed_at is not null then 'finished' else 'ready' end where id = p.id;
    else raise sqlstate 'PT409' using message = 'Cannot continue';
    end if;
  else raise sqlstate 'PT400' using message = 'Unknown challenge action';
  end if;
  return public.heritage_challenge_state(p_code, p_hash);
end;
$$;

revoke all on function public.heritage_challenge_snapshot_guard(), public.heritage_challenge_answer_guard(), public.heritage_challenge_questions(jsonb), public.heritage_challenge_state(text, text), public.heritage_challenge_action(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.heritage_challenge_questions(jsonb), public.heritage_challenge_state(text, text), public.heritage_challenge_action(text, text, text, jsonb) to service_role;
