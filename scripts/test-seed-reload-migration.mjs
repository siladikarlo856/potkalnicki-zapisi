// Verify the seed word reload migration against an already-running local Supabase Postgres.
// Everything is rolled back; no stack lifecycle commands, resets or persistent schema changes.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const migration = readFileSync(new URL('../supabase/migrations/20261102120000_reload_seed_words.sql', import.meta.url), 'utf8')
  .replace(/^(begin|commit);$/gm, '')
const psql = ['exec', '-i', 'supabase_db_ksh', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
const probe = spawnSync('docker', [...psql, '-tAc', `select to_regclass('public.heritage_daily_words') is not null`], { encoding: 'utf8' })
if (probe.error) throw probe.error
if (probe.status !== 0) {
  process.stderr.write(probe.stderr)
  process.exit(probe.status ?? 1)
}
const dailyMigration = probe.stdout.trim() === 't'
  ? ''
  : readFileSync(new URL('../supabase/migrations/20261102110000_heritage_daily_words.sql', import.meta.url), 'utf8')
const result = spawnSync('docker', psql, {
  encoding: 'utf8',
  input: `begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';
${dailyMigration}
do $setup$
declare tpl public.heritage_words%rowtype;
begin
  select * into tpl from public.heritage_words where submission_id is null limit 1;
  if not found then raise exception 'No template word to copy; apply the earlier word migrations first'; end if;
  insert into public.heritage_words (id, entry, active)
  select i, jsonb_set(tpl.entry, '{id}', to_jsonb(i)), true
  from unnest(array['hiza', 'babica', 'zz-unrelated-test']) as i
  on conflict (id) do nothing;
  insert into public.heritage_daily_words (day, word_id, source) values ('2099-01-01', 'hiza', 'pinned');
  insert into public.heritage_daily_words (day, word_id, source, snapshot, resolved_at)
  values ('2099-01-02', 'babica', 'auto', '{}'::jsonb, now());
  insert into public.heritage_daily_words (day, word_id, source) values ('2099-01-03', 'zz-unrelated-test', 'pinned');
end $setup$;
${migration}
do $test$
declare n int;
begin
  if exists (select 1 from public.heritage_daily_words where day in ('2099-01-01', '2099-01-02')) then
    raise exception 'Daily rows on old ids survived';
  end if;
  if not exists (select 1 from public.heritage_daily_words where day = '2099-01-03' and word_id = 'zz-unrelated-test') then
    raise exception 'Unrelated daily row was removed';
  end if;
  if not exists (select 1 from public.heritage_words where id = 'zz-unrelated-test') then
    raise exception 'Unrelated word was removed';
  end if;
  if exists (select 1 from public.heritage_words where id in ('hiza', 'babica')) then
    raise exception 'Old text ids survived';
  end if;
  select count(*) into n from public.heritage_words
  where id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and entry->>'id' = id and submission_id is null;
  if n <> 61 then raise exception 'Expected 61 UUID words, found %', n; end if;
  select count(*) into n from public.heritage_words
  where id ~ '^[0-9a-f]{8}-' and entry->>'id' = id and submission_id is null and active;
  if n <> 51 then raise exception 'Expected 51 active UUID words, found %', n; end if;
  if not exists (select 1 from pg_trigger where tgname = 'heritage_daily_word_guard'
    and tgrelid = 'public.heritage_daily_words'::regclass and tgenabled = 'O') then
    raise exception 'heritage_daily_word_guard is not enabled';
  end if;
end $test$;
rollback;
select 'seed reload migration verified; transaction rolled back' as result;
`
})
process.stdout.write(result.stdout || '')
process.stderr.write(result.stderr || '')
if (result.error) throw result.error
process.exitCode = result.status ?? 1
