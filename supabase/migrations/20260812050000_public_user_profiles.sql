-- Public profile visibility toggle (enforced on profile page in the app).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
