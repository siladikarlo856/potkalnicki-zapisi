-- WP15: expose optional map layout on the current challenge question in heritage_challenge_state.

create or replace function public.heritage_challenge_state(p_code text, p_hash text) returns jsonb
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
    'question', case when q is not null then jsonb_build_object('id', q->'id', 'prompt', q->'prompt', 'options', q->'options', 'round', q->'round', 'number', q->'number', 'display', q->'display') end,
    'feedback', case when a.answered_at is not null then jsonb_build_object('selected', a.selected, 'correct', q->'correct', 'points', a.points, 'explanation', q->'explanation') end
  );
end;
$$;

revoke all on function public.heritage_challenge_snapshot_guard(), public.heritage_challenge_answer_guard(), public.heritage_challenge_questions(jsonb), public.heritage_challenge_state(text, text), public.heritage_challenge_action(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.heritage_challenge_questions(jsonb), public.heritage_challenge_state(text, text), public.heritage_challenge_action(text, text, text, jsonb) to service_role;
