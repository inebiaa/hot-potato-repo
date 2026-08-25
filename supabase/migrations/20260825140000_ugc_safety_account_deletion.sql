-- UGC safety (reports, blocks) and account deletion (preserve public reviews).

-- ---------------------------------------------------------------------------
-- Ratings: keep author display name when account is deleted
-- ---------------------------------------------------------------------------

ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS author_display_name text;

UPDATE public.ratings r
SET author_display_name = p.username
FROM public.user_profiles p
WHERE r.user_id = p.user_id
  AND (r.author_display_name IS NULL OR btrim(r.author_display_name) = '');

UPDATE public.ratings
SET author_display_name = 'Unknown User'
WHERE author_display_name IS NULL OR btrim(author_display_name) = '';

ALTER TABLE public.ratings
  ALTER COLUMN author_display_name SET NOT NULL;

ALTER TABLE public.ratings
  DROP CONSTRAINT IF EXISTS ratings_user_id_fkey;

ALTER TABLE public.ratings
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.ratings
  ADD CONSTRAINT ratings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_rating_author_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL
     AND (NEW.author_display_name IS NULL OR btrim(NEW.author_display_name) = '') THEN
    SELECT p.username INTO NEW.author_display_name
    FROM public.user_profiles p
    WHERE p.user_id = NEW.user_id;
  END IF;
  IF NEW.author_display_name IS NULL OR btrim(NEW.author_display_name) = '' THEN
    NEW.author_display_name := 'Unknown User';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ratings_set_author_display_name ON public.ratings;
CREATE TRIGGER ratings_set_author_display_name
  BEFORE INSERT OR UPDATE OF user_id, author_display_name ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_rating_author_display_name();

-- ---------------------------------------------------------------------------
-- Content reports
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('rating', 'profile', 'list', 'event')),
  target_id uuid NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'other')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status_created
  ON public.content_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_reports_target
  ON public.content_reports (target_type, target_id);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own reports" ON public.content_reports;
CREATE POLICY "Users can insert own reports"
  ON public.content_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can view own reports" ON public.content_reports;
CREATE POLICY "Users can view own reports"
  ON public.content_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can view all reports" ON public.content_reports;
CREATE POLICY "Admins can view all reports"
  ON public.content_reports
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update reports" ON public.content_reports;
CREATE POLICY "Admins can update reports"
  ON public.content_reports
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- User blocks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks (blocker_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own blocks" ON public.user_blocks;
CREATE POLICY "Users manage own blocks"
  ON public.user_blocks
  FOR ALL
  TO authenticated
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

-- ---------------------------------------------------------------------------
-- Admin moderation on UGC
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can delete any rating" ON public.ratings;
CREATE POLICY "Admins can delete any rating"
  ON public.ratings
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update any profile" ON public.user_profiles;
CREATE POLICY "Admins can update any profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete any list" ON public.user_lists;
CREATE POLICY "Admins can delete any list"
  ON public.user_lists
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));
