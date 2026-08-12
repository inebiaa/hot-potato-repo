-- Profile avatars: column + public storage bucket (users write under `{uid}/…`).

alter table public.user_profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_images_public_read" on storage.objects;
drop policy if exists "profile_images_authenticated_insert" on storage.objects;
drop policy if exists "profile_images_authenticated_update" on storage.objects;
drop policy if exists "profile_images_authenticated_delete" on storage.objects;

create policy "profile_images_public_read"
on storage.objects
for select
to public
using (bucket_id = 'profile-images');

create policy "profile_images_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "profile_images_authenticated_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "profile_images_authenticated_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
