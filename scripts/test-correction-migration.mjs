// Verify the heritage correction migration against an already-running local Supabase Postgres.
// Everything is rolled back; no stack lifecycle commands, resets or persistent schema changes.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const migration = readFileSync(new URL('../supabase/migrations/20261102100000_submission_corrections.sql', import.meta.url), 'utf8')
const result = spawnSync('docker', ['exec', '-i', 'supabase_db_ksh', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
  encoding: 'utf8',
  input: `begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';
insert into public.heritage_submissions(id,text,type,place,consent_publish,consent_version,locale)
overriding system value values(-20261102,'migration legacy test','memory','Kalnik',true,'2026-10-27','hr');
${migration}
do $test$
begin
  if not exists(select 1 from public.heritage_submissions where id=-20261102 and target_ref is null and type='memory') then
    raise exception 'Legacy row was changed';
  end if;
  insert into public.heritage_submissions(id,text,type,target_ref,consent_publish,consent_version,locale)
  overriding system value values(-20261103,'correction body','correction','kalnik-crkva-sv-brcka',true,'2026-10-27','hr');
  begin
    insert into public.heritage_submissions(text,type,consent_publish,consent_version,locale)
    values ('missing target','correction',true,'2026-10-27','hr');
    raise exception 'Correction without target_ref was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.heritage_submissions(text,type,target_ref,consent_publish,consent_version,locale)
    values ('orphan target','word','kalnik-crkva-sv-brcka',true,'2026-10-27','hr');
    raise exception 'target_ref on non-correction was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.heritage_submissions(text,type,target_ref,consent_publish,consent_version,locale)
    values ('bad ref','correction','Bad Ref!',true,'2026-10-27','hr');
    raise exception 'Invalid target_ref format was accepted';
  exception when check_violation then null;
  end;
end $test$;
rollback;
select 'migration verified; transaction rolled back' as result;
`
})
process.stdout.write(result.stdout || '')
process.stderr.write(result.stderr || '')
if (result.error) throw result.error
process.exitCode = result.status ?? 1
