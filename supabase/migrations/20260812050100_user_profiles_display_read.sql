-- Keep profile display names readable for ratings/comments; is_public gates the profile page in the app.

DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.user_profiles;

CREATE POLICY "Anyone can view user profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated, anon
  USING (true);
