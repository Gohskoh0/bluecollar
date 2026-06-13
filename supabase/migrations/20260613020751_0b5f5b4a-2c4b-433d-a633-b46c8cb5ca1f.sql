
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  candidate text;
  suffix int := 0;
  ut public.user_type;
  fn text;
BEGIN
  fn := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1));
  BEGIN
    ut := COALESCE((NEW.raw_user_meta_data->>'user_type')::public.user_type, 'professional'::public.user_type);
  EXCEPTION WHEN others THEN
    ut := 'professional'::public.user_type;
  END;

  base_username := regexp_replace(lower(split_part(NEW.email, '@', 1)), '[^a-z0-9_]', '', 'g');
  IF base_username = '' THEN base_username := 'user'; END IF;
  candidate := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, full_name, user_type)
  VALUES (NEW.id, candidate, fn, ut)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users missing a profile
INSERT INTO public.profiles (id, username, full_name, user_type)
SELECT
  u.id,
  regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_]', '', 'g') ||
    CASE WHEN row_number() OVER (PARTITION BY regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_]', '', 'g') ORDER BY u.created_at) = 1
         THEN '' ELSE (row_number() OVER (PARTITION BY regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_]', '', 'g') ORDER BY u.created_at) - 1)::text END,
  COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
  COALESCE((u.raw_user_meta_data->>'user_type')::public.user_type, 'professional'::public.user_type)
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
