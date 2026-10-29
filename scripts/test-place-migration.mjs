// Verify the additive migration against an already-running local Supabase Postgres.
// Everything is rolled back; no stack lifecycle commands, resets or persistent schema changes.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const migration = readFileSync(new URL('../supabase/migrations/20261030000000_submission_places.sql', import.meta.url), 'utf8')
const result = spawnSync('docker', ['exec', '-i', 'supabase_db_ksh', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
  encoding: 'utf8',
  input: `begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';
insert into public.heritage_submissions(id,text,place,consent_publish,consent_version,locale)
overriding system value values(-20261028,'migration legacy test','Near Orehovec — untouched',true,'2026-10-27','hr');
${migration}
do $test$
begin
  if not exists(select 1 from public.heritage_submissions where id=-20261028 and place='Near Orehovec — untouched' and place_id is null and place_catalog_version is null) then
    raise exception 'Legacy location was changed';
  end if;
  insert into public.heritage_submissions(id,text,place,place_id,place_catalog_version,consent_publish,consent_version,locale)
  overriding system value values(-20261029,'migration canonical test','Križevci (geonames:3197230)','geonames:3197230','test-v1',true,'2026-10-27','hr');
  begin
    update public.heritage_submissions set place_catalog_version=null where id=-20261029;
    raise exception 'Missing version was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.heritage_submissions set place=repeat('x',121) where id=-20261029;
    raise exception 'Original max120 constraint was lost';
  exception when check_violation then null;
  end;
  if has_column_privilege('anon','public.heritage_submissions','place_id','INSERT') or has_table_privilege('authenticated','public.heritage_submissions','SELECT') then
    raise exception 'Public access changed';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.heritage_submissions'::regclass) then
    raise exception 'RLS was disabled';
  end if;
end $test$;
rollback;
select 'migration verified; transaction rolled back' as result;
`
})
process.stdout.write(result.stdout || '')
process.stderr.write(result.stderr || '')
if (result.error) throw result.error
process.exitCode = result.status ?? 1
