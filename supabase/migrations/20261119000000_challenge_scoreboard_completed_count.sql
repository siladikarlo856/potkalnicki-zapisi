create or replace function public.heritage_challenge_scoreboard(p_code text, p_offset integer default 0) returns jsonb
language plpgsql set search_path = '' as $$
declare
  snapshot jsonb;
  result jsonb;
begin
  select content into snapshot from public.heritage_challenges where code = p_code;
  if not found then raise sqlstate 'PT404' using message = 'Challenge not found'; end if;
  with question_rounds as (
    select (row_number() over (order by r.ordinality, q.ordinality) - 1)::integer as question_index,
      (r.ordinality - 1)::integer as round_index
    from jsonb_array_elements(snapshot->'rounds') with ordinality r
    cross join lateral jsonb_array_elements(r.value->'questions') with ordinality q
  ), participants as (
    select id, nickname, total_score, completed_at,
      rank() over (order by total_score desc) as position
    from public.heritage_challenge_participants where challenge_code = p_code
  ), page as (
    select * from participants order by total_score desc, lower(nickname), nickname
    limit 50 offset greatest(0, least(1000000, p_offset))
  ), scores as (
    select a.participant_id, qr.round_index, sum(a.points) as points
    from public.heritage_challenge_answers a
    join page p on p.id = a.participant_id
    join question_rounds qr on qr.question_index = a.question_index
    where a.answered_at is not null
    group by a.participant_id, qr.round_index
  ), board as (
    select p.nickname, p.total_score as total, p.position as rank, p.completed_at as "completedAt",
      jsonb_agg(coalesce(s.points, 0) order by r.ordinality) as rounds
    from page p
    cross join jsonb_array_elements(snapshot->'rounds') with ordinality r
    left join scores s on s.participant_id = p.id and s.round_index = r.ordinality - 1
    group by p.id, p.nickname, p.total_score, p.position, p.completed_at
  )
  select jsonb_build_object('rows', coalesce(jsonb_agg(to_jsonb(b) order by b.total desc, lower(b.nickname), b.nickname), '[]'),
    'count', (select count(*) from participants),
    'completedCount', (select count(*) from participants where completed_at is not null)) into result from board b;
  return result;
end;
$$;
revoke all on function public.heritage_challenge_scoreboard(text, integer) from public, anon, authenticated;
grant execute on function public.heritage_challenge_scoreboard(text, integer) to service_role;
