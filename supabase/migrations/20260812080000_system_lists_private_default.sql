-- Liked Events and Reviews boards default to private.
UPDATE user_lists
SET is_public = false
WHERE is_liked_list = true OR is_rated_list = true;
