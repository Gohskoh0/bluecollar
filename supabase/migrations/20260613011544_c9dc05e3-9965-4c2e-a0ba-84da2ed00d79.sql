CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_base TEXT;
  v_i INT := 0;
BEGIN
  v_base := lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), '[^a-z0-9_]', '', 'g'));
  IF v_base = '' OR v_base IS NULL THEN
    v_base := 'user';
  END IF;

  v_username := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_i := v_i + 1;
    v_username := v_base || v_i::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, full_name, user_type)
  VALUES (
    NEW.id,
    v_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', v_base),
    COALESCE((NEW.raw_user_meta_data->>'user_type')::public.user_type, 'professional')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON public.jobs;
CREATE TRIGGER trg_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_follow_counts ON public.follows;
CREATE TRIGGER trg_follow_counts
AFTER INSERT OR DELETE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.handle_follow_counts();

DROP TRIGGER IF EXISTS trg_like_counts ON public.likes;
CREATE TRIGGER trg_like_counts
AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.handle_like_counts();

DROP TRIGGER IF EXISTS trg_comment_counts ON public.comments;
CREATE TRIGGER trg_comment_counts
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_counts();

DROP TRIGGER IF EXISTS trg_app_count ON public.applications;
CREATE TRIGGER trg_app_count
AFTER INSERT ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.bump_application_count();

DROP TRIGGER IF EXISTS trg_reward_event ON public.reward_events;
CREATE TRIGGER trg_reward_event
AFTER INSERT ON public.reward_events
FOR EACH ROW EXECUTE FUNCTION public.handle_reward_event();

DROP TRIGGER IF EXISTS trg_growth_contrib ON public.growth_contributions;
CREATE TRIGGER trg_growth_contrib
AFTER INSERT ON public.growth_contributions
FOR EACH ROW EXECUTE FUNCTION public.handle_growth_contribution();

INSERT INTO public.profiles (id, username, full_name, user_type)
SELECT
  u.id,
  lower(regexp_replace(COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1), 'user'), '[^a-z0-9_]', '', 'g')) || '_' || substr(u.id::text, 1, 6),
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'BlueCollar Member'),
  COALESCE((u.raw_user_meta_data->>'user_type')::public.user_type, 'professional')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::public.app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'user'
WHERE r.id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;