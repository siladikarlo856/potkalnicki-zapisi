-- Photos of heritage items, with the credit each one needs (author, licence, source), and the public
-- Storage bucket that holds the files.
--
-- * heritage_item_images: an item's ordered photos (position 0 is the main one), saved with the item like its
--   sources. `path` is the large copy, `thumb_path` the small one, both in the bucket heritage-media.
--   Licences are an allowlist of free licences plus `permission` (used with the rights holder's written
--   permission, the only case where `source_url` may be empty). Deleting an item drops its photo rows; the
--   files stay in the bucket.
-- * content_heritage_item_save gains p_images and saves the photos in the same transaction as the row and
--   its sources, recording them on the revision (data->'sidecars'->'images'). The four-argument version stays
--   for the app that is still running while this migration is applied; it never touches photos.
-- * The bucket is created only where Supabase Storage exists (hosted and full local stacks). The disposable
--   Postgres that CI runs migrations on has no storage schema, so there it is skipped.

create table public.heritage_item_images (
  item_id uuid not null references public.heritage_items(id) on delete cascade,
  position smallint not null check (position between 0 and 5),
  path text not null check (path ~ '^heritage/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'),
  thumb_path text not null check (thumb_path ~ '^heritage/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-thumb\.(webp|jpg)$'),
  width integer not null check (width between 1 and 4000),
  height integer not null check (height between 1 and 4000),
  alt text not null check (char_length(btrim(alt)) between 1 and 300),
  caption text check (char_length(btrim(caption)) between 1 and 500),
  author text not null check (char_length(btrim(author)) between 1 and 200),
  author_url text check (author_url ~ '^https?://[^\s]+$' and char_length(author_url) <= 1000),
  source_url text check (source_url ~ '^https?://[^\s]+$' and char_length(source_url) <= 1000),
  license text not null check (license in (
    'pd', 'cc0-1.0', 'cc-by-2.0', 'cc-by-2.5', 'cc-by-3.0', 'cc-by-4.0',
    'cc-by-sa-2.0', 'cc-by-sa-2.5', 'cc-by-sa-3.0', 'cc-by-sa-4.0', 'permission'
  )),
  primary key (item_id, position),
  constraint heritage_item_images_source check (source_url is not null or license = 'permission')
);

alter table public.heritage_item_images enable row level security;
revoke all privileges on table public.heritage_item_images from public, anon, authenticated;
grant all privileges on table public.heritage_item_images to service_role;

create function public.content_heritage_item_save(
  p_id uuid, p_revision integer, p_row jsonb, p_source_ids jsonb, p_images jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.heritage_items := jsonb_populate_record(null::public.heritage_items, p_row);
  saved uuid := coalesce(p_id, r.id, gen_random_uuid());
begin
  perform set_config('app.revision_sidecars', jsonb_build_object('id', saved, 'sidecars', jsonb_build_object(
    'sourceIds', coalesce(p_source_ids, '[]'), 'images', coalesce(p_images, '[]')
  ))::text, true);
  if p_id is null then
    insert into public.heritage_items (
      id, revision, created_at,
      name, slug, category_id, municipality_id, settlement_id, locality, verification, heritage_status,
      registry_number, period, description, research_notes, latitude, longitude, noindex, status,
      apply_submission_id, apply_credit, source_submission_id
    ) values (
      saved, coalesce(r.revision, 1), coalesce(r.created_at, now()),
      r.name, r.slug, r.category_id, r.municipality_id, r.settlement_id, r.locality, r.verification, r.heritage_status,
      r.registry_number, r.period, r.description, r.research_notes, r.latitude, r.longitude, r.noindex, r.status,
      r.apply_submission_id, r.apply_credit, r.source_submission_id
    );
  else
    update public.heritage_items set
      name = r.name, slug = r.slug, category_id = r.category_id, municipality_id = r.municipality_id,
      settlement_id = r.settlement_id, locality = r.locality, verification = r.verification,
      heritage_status = r.heritage_status, registry_number = r.registry_number, period = r.period,
      description = r.description, research_notes = r.research_notes, latitude = r.latitude, longitude = r.longitude,
      noindex = r.noindex, status = r.status, apply_submission_id = r.apply_submission_id, apply_credit = r.apply_credit
    where id = p_id and revision = p_revision;
    if not found then
      perform set_config('app.revision_sidecars', '', true);
      return null;
    end if;
  end if;

  delete from public.heritage_item_sources where item_id = saved;
  insert into public.heritage_item_sources (item_id, source_id, position)
  select saved, (source #>> '{}')::uuid, (n - 1)::smallint
  from jsonb_array_elements(coalesce(p_source_ids, '[]')) with ordinality as t(source, n);

  delete from public.heritage_item_images where item_id = saved;
  insert into public.heritage_item_images (
    item_id, position, path, thumb_path, width, height, alt, caption, author, author_url, source_url, license
  )
  select saved, (n - 1)::smallint, image->>'path', image->>'thumbPath', (image->>'width')::integer,
    (image->>'height')::integer, image->>'alt', image->>'caption', image->>'author', image->>'authorUrl',
    image->>'sourceUrl', image->>'license'
  from jsonb_array_elements(coalesce(p_images, '[]')) with ordinality as t(image, n);

  return saved;
end;
$$;

revoke all on function public.content_heritage_item_save(uuid, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.content_heritage_item_save(uuid, integer, jsonb, jsonb, jsonb) to service_role;

-- Public bucket for the photo files: anyone may read a file by its URL; only the server's secret key
-- (which bypasses Storage policies) writes. Re-running keeps an existing bucket and resets its limits.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    execute $sql$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('heritage-media', 'heritage-media', true, 2097152, array['image/webp', 'image/jpeg'])
      on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types
    $sql$;
  end if;
end $$;
