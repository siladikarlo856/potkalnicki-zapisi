-- Heritage item corrections ("Predloži ispravak"): type correction + atlas item id in target_ref.
-- Apply before deploying the matching app; older app code ignores the new column and type value.
alter table public.heritage_submissions
  drop constraint if exists heritage_submissions_type_check;

alter table public.heritage_submissions
  add constraint heritage_submissions_type_check check (
    type is null or type in ('word', 'expression', 'memory', 'other', 'correction')
  );

alter table public.heritage_submissions
  add column target_ref text;

alter table public.heritage_submissions
  add constraint heritage_submissions_target_ref_format_check check (
    target_ref is null or (
      char_length(target_ref) between 1 and 120
      and target_ref ~ '^[a-z0-9-]+$'
    )
  );

alter table public.heritage_submissions
  add constraint heritage_submissions_correction_target_check check (
    (type = 'correction' and target_ref is not null)
    or (type is distinct from 'correction' and target_ref is null)
  );

comment on column public.heritage_submissions.target_ref is
  'Atlas heritage item id when type is correction; null for all other submission kinds.';
