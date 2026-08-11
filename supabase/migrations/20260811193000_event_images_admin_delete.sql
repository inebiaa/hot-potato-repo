-- Allow admins to remove any object in event-images (owners already can via folder match).
drop policy if exists "event_images_authenticated_delete" on storage.objects;

create policy "event_images_authenticated_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'event-images'
  and (
    (storage.foldername(name))[1] = (select auth.uid()::text)
    or public.is_admin(auth.uid())
  )
);
