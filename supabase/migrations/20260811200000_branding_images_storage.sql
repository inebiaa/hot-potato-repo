-- Public bucket for durable branding assets (admins upload; anyone can view).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding-images',
  'branding-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "branding_images_public_read" on storage.objects;
drop policy if exists "branding_images_admin_insert" on storage.objects;
drop policy if exists "branding_images_admin_update" on storage.objects;
drop policy if exists "branding_images_admin_delete" on storage.objects;

create policy "branding_images_public_read"
on storage.objects
for select
to public
using (bucket_id = 'branding-images');

create policy "branding_images_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'branding-images'
  and public.is_admin(auth.uid())
);

create policy "branding_images_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'branding-images'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'branding-images'
  and public.is_admin(auth.uid())
);

create policy "branding_images_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'branding-images'
  and public.is_admin(auth.uid())
);
