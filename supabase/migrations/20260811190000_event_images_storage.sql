-- Public bucket for durable event card photos (users upload; anyone can view).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images',
  'event-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "event_images_public_read" on storage.objects;
drop policy if exists "event_images_authenticated_insert" on storage.objects;
drop policy if exists "event_images_authenticated_update" on storage.objects;
drop policy if exists "event_images_authenticated_delete" on storage.objects;

-- Public bucket serves files without auth; policy still needed for API listing/select in some paths.
create policy "event_images_public_read"
on storage.objects
for select
to public
using (bucket_id = 'event-images');

-- Path must be `{auth.uid()}/…` so each user only writes under their folder.
create policy "event_images_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "event_images_authenticated_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'event-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'event-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "event_images_authenticated_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'event-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
