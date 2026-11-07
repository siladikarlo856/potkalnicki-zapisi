-- Record a finished Quiz-result challenge in one call. `create_completed` takes the challenge content
-- (the Quiz questions), the creator's nickname and the Quiz results, and writes the finished
-- Participant state directly instead of the server replaying reveal/answer/continue per question.
-- Everything else in heritage_challenge_action is unchanged from 20261031000000_heritage_challenges.

create or replace function public.heritage_challenge_action(p_action text, p_code text, p_hash text default null, p_input jsonb default '{}') returns jsonb
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
  results jsonb;
begin
  if p_action in ('create', 'create_completed') then
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
  if p_action in ('create', 'create_completed', 'join', 'reveal', 'answer') and instant >= c.closes_at then
    raise sqlstate 'PT410' using message = 'Challenge closed';
  end if;
  select * into p from public.heritage_challenge_participants where challenge_code = p_code and token_hash = p_hash for update;
  if p_action in ('create', 'create_completed', 'join') then
    if p.id is null then
      nickname := p_input->>'nickname';
      if nickname is null or char_length(nickname) not between 2 and 24 or nickname <> btrim(nickname) or nickname !~ '^[[:alnum:]][[:alnum:] ._''-]*$' then
        raise sqlstate 'PT400' using message = 'Invalid nickname';
      end if;
      begin
        insert into public.heritage_challenge_participants (challenge_code, nickname, token_hash) values (p_code, nickname, p_hash)
          returning * into p;
      exception when unique_violation then
        raise sqlstate 'PT409' using message = 'Nickname taken';
      end;
    end if;
    if p_action = 'create_completed' then
      -- One boolean per question, in play order. The Quiz keeps only whether each answer was right,
      -- so a right answer stores the correct option and a wrong one stores no selection.
      questions := public.heritage_challenge_questions(c.content);
      results := p_input->'results';
      if jsonb_typeof(results) is distinct from 'array' then
        raise sqlstate 'PT400' using message = 'Invalid quiz results';
      end if;
      if jsonb_array_length(results) <> jsonb_array_length(questions)
        or exists (select 1 from jsonb_array_elements(results) r where jsonb_typeof(r.value) <> 'boolean') then
        raise sqlstate 'PT400' using message = 'Invalid quiz results';
      end if;
      insert into public.heritage_challenge_answers (participant_id, question_index, revealed_at, selected, answered_at, correct, points)
        select p.id, r.ordinality - 1, instant,
          case when r.value = 'true'::jsonb then (questions->(r.ordinality::integer - 1)->>'correct')::integer end,
          instant, r.value = 'true'::jsonb, case when r.value = 'true'::jsonb then 100 else 0 end
        from jsonb_array_elements(results) with ordinality r;
      update public.heritage_challenge_participants set phase = 'finished', question_index = jsonb_array_length(questions),
        total_score = (select count(*) * 100 from jsonb_array_elements(results) r where r.value = 'true'::jsonb), completed_at = instant
        where id = p.id;
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

revoke all on function public.heritage_challenge_action(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.heritage_challenge_action(text, text, text, jsonb) to service_role;
