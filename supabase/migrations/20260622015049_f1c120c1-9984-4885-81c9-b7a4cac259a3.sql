
-- 1. Profiles SELECT: authenticated only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);

-- Public-safe view of profiles (excludes kyc_verified, plan, profile_completeness)
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT
  id, username, full_name, avatar_url, cover_url, headline, bio, location,
  user_type, skills, work_history,
  follower_count, following_count,
  qes_score, reputation_score, verified_badge,
  created_at, updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Need anon SELECT on profiles for the security_invoker view, but restricted to safe columns is impossible at policy level.
-- Instead, allow anon SELECT only when used via the view by adding a permissive policy granting anon access (still exposes columns directly).
-- Better: keep base table restricted; view runs as invoker. For anon to use the view, base table also needs anon SELECT.
-- So instead use SECURITY DEFINER view by switching off security_invoker:
DROP VIEW public.profiles_public;
CREATE VIEW public.profiles_public AS
SELECT
  id, username, full_name, avatar_url, cover_url, headline, bio, location,
  user_type, skills, work_history,
  follower_count, following_count,
  qes_score, reputation_score, verified_badge,
  created_at, updated_at
FROM public.profiles;
ALTER VIEW public.profiles_public OWNER TO postgres;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 2. Growth contributions: restrict reads
DROP POLICY IF EXISTS "Contribs public read" ON public.growth_contributions;
CREATE POLICY "Contribs visible to contributor or company owner"
  ON public.growth_contributions FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT owner_id FROM public.companies WHERE id = company_id)
  );

-- 3. Reward events: remove user INSERT, add automatic triggers
DROP POLICY IF EXISTS "Users add own events" ON public.reward_events;

CREATE OR REPLACE FUNCTION public.award_like_reward()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.reward_events (user_id, action, weight, pool)
  VALUES (NEW.user_id, 'like', 1, 'content');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.award_like_reward() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_award_like_reward ON public.likes;
CREATE TRIGGER trg_award_like_reward
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.award_like_reward();

CREATE OR REPLACE FUNCTION public.award_application_reward()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.reward_events (user_id, action, weight, pool)
  VALUES (NEW.applicant_id, 'job_application', 5, 'hiring');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.award_application_reward() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_award_application_reward ON public.applications;
CREATE TRIGGER trg_award_application_reward
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.award_application_reward();

-- 4. Subscriptions: remove user INSERT/UPDATE policies (server-side only)
DROP POLICY IF EXISTS "Users insert own subs" ON public.subscriptions;
DROP POLICY IF EXISTS "Users update own subs" ON public.subscriptions;

-- 5. Storage: remove public read on profiles bucket
DROP POLICY IF EXISTS "Profile files are publicly readable" ON storage.objects;
CREATE POLICY "Profile files readable by authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profiles');

-- 6. Lock down SECURITY DEFINER helper functions from API execution
REVOKE EXECUTE ON FUNCTION public.handle_reward_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_application_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_follow_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_like_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_growth_contribution() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_comment_counts() FROM PUBLIC, anon, authenticated;
-- has_role is invoked from RLS policies and may be called from server code; keep authenticated execute
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
