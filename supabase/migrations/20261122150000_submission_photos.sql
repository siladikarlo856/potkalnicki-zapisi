-- Photographs sent through Doprinesi by signed-in contributors. Files sit in a private Storage bucket;
-- only the server (service_role) reads rows or objects. The bucket is created only where Supabase Storage exists.

alter table public.heritage_submissions
  drop constraint heritage_submissions_type_check,
  add constraint heritage_submissions_type_check check (
    type is null or type in ('word', 'expression', 'memory', 'other', 'correction', 'proposal', 'photo')
  );

create table public.heritage_submission_photos (
  id uuid primary key default gen_random_uuid(),
  submission_id bigint not null references public.heritage_submissions(id) on delete cascade,
  account_id uuid not null references public.account_profiles(id),
  position smallint not null check (position between 0 and 4),
  path text not null check (path ~ '^submissions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$'),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  byte_size integer not null check (byte_size between 1 and 10485760),
  alt text not null check (char_length(btrim(alt)) between 1 and 300),
  author text not null check (char_length(btrim(author)) between 1 and 200),
  publish_permission boolean not null check (publish_permission),
  created_at timestamptz not null default now(),
  unique (submission_id, position)
);

create index heritage_submission_photos_submission on public.heritage_submission_photos (submission_id, position);

alter table public.heritage_submission_photos enable row level security;
revoke all privileges on table public.heritage_submission_photos from public, anon, authenticated;
grant all privileges on table public.heritage_submission_photos to service_role;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    execute $sql$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('submission-media', 'submission-media', false, 10485760, array['image/jpeg', 'image/png'])
      on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types
    $sql$;
  end if;
end $$;
