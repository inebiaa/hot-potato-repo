-- Fix "role mutable search_path" security warning on is_admin
-- SECURITY DEFINER functions must explicitly set search_path to prevent
-- callers from redirecting unqualified object lookups to malicious schemas.
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = check_user_id
  );
$$;
