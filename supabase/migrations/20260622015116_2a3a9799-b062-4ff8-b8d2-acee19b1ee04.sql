
-- Recreate profiles_public as security_invoker view
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT
  id, username, full_name, avatar_url, cover_url, headline, bio, location,
  user_type, skills, work_history,
  follower_count, following_count,
  qes_score, reputation_score, verified_badge,
  created_at, updated_at
FROM public.profiles;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Allow anon to read profiles, but only the safe columns (column-level privilege)
CREATE POLICY "Profiles public-safe read for anon"
  ON public.profiles FOR SELECT TO anon USING (true);

REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, username, full_name, avatar_url, cover_url, headline, bio, location,
  user_type, skills, work_history,
  follower_count, following_count,
  qes_score, reputation_score, verified_badge,
  created_at, updated_at
) ON public.profiles TO anon;

-- has_role is invoked inside RLS policies, which evaluate it with definer rights regardless of EXECUTE.
-- Revoke EXECUTE from authenticated as well to remove the API-callable surface.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
