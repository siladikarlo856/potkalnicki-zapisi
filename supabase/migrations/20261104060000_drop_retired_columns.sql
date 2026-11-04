-- Contract step of the CMS content migration: drops the two columns the app stopped reading and writing in
-- https://github.com/siladikarlo856/karlo-siladi-from-hr/pull/63. IRREVERSIBLE in place; take a
-- `supabase db dump --linked` backup first (see docs/database.md, "Retired columns migration").

-- heritage_words.areas: nothing reads or writes it any more.
drop trigger heritage_word_areas_project on public.heritage_words;
drop function public.heritage_word_areas_project();
drop function public.areas_hierarchy_jsonb(uuid[]);
-- This check measured the column too; a column drop would otherwise remove it silently.
alter table public.heritage_words drop constraint heritage_word_payload_size;
alter table public.heritage_words drop column areas;
alter table public.heritage_words add constraint heritage_word_payload_size check (octet_length(entry::text) <= 131072);

-- heritage_submissions.target_ref and the checks that protect it.
alter table public.heritage_submissions drop constraint heritage_submissions_correction_target_check;
alter table public.heritage_submissions drop constraint heritage_submissions_target_ref_format_check;
alter table public.heritage_submissions drop column target_ref;
