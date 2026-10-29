-- Additive only: legacy place strings are retained verbatim, with no guessed IDs.
-- Apply this migration BEFORE deploying the matching server and catalog.
alter table public.heritage_submissions
  add column place_id text,
  add column place_catalog_version text;

alter table public.heritage_submissions
  add constraint heritage_submissions_place_reference_check check (
    (place_id is null and place_catalog_version is null)
    or (
      place_id is not null and place_id ~ '^geonames:[0-9]{1,10}$'
      and place_catalog_version is not null
      and char_length(place_catalog_version) between 1 and 80
      and place is not null
    )
  );

comment on column public.heritage_submissions.place_id is
  'Canonical Croatian settlement ID validated by the application catalog; null for legacy/unverified text.';
comment on column public.heritage_submissions.place_catalog_version is
  'Catalog snapshot used when accepting the place ID. Nullable columns permit app rollback.';
