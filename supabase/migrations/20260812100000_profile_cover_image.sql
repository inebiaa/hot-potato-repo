-- Profile page cover photo (same storage bucket as avatars).

alter table public.user_profiles
  add column if not exists cover_image_url text;

-- Allow larger cover uploads (avatars stay compressed smaller client-side).
update storage.buckets
set file_size_limit = 5242880
where id = 'profile-images';
