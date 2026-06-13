
-- =============== ENUMS ===============
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.user_type AS ENUM ('professional', 'recruiter', 'company');
CREATE TYPE public.subscription_plan AS ENUM ('free', 'pro', 'expert', 'recruiter_pro', 'recruiter_expert');
CREATE TYPE public.job_type AS ENUM ('full_time', 'part_time', 'contract', 'internship', 'remote');
CREATE TYPE public.application_status AS ENUM ('pending', 'reviewed', 'interview', 'hired', 'rejected');

-- =============== PROFILES ===============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  headline TEXT,
  bio TEXT,
  location TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  user_type public.user_type NOT NULL DEFAULT 'professional',
  plan public.subscription_plan NOT NULL DEFAULT 'free',
  kyc_verified BOOLEAN NOT NULL DEFAULT false,
  verified_badge BOOLEAN NOT NULL DEFAULT false,
  reputation_score INT NOT NULL DEFAULT 0,
  qes_score BIGINT NOT NULL DEFAULT 0,
  follower_count INT NOT NULL DEFAULT 0,
  following_count INT NOT NULL DEFAULT 0,
  profile_completeness INT NOT NULL DEFAULT 20,
  skills TEXT[] DEFAULT '{}',
  work_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- =============== USER ROLES ===============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- =============== AUTO PROFILE ON SIGNUP ===============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username TEXT;
  v_base TEXT;
  v_i INT := 0;
BEGIN
  v_base := lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), '[^a-z0-9_]', '', 'g'));
  IF v_base = '' OR v_base IS NULL THEN v_base := 'user'; END IF;
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
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============== UPDATED_AT TRIGGER ===============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============== FOLLOWS ===============
CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT SELECT ON public.follows TO anon;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follows readable by all" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users follow" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users unfollow" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE OR REPLACE FUNCTION public.handle_follow_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.following_id;
    UPDATE public.profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_follow_counts AFTER INSERT OR DELETE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.handle_follow_counts();

-- =============== COMPANIES ===============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tagline TEXT,
  description TEXT,
  industry TEXT,
  website TEXT,
  logo_url TEXT,
  cover_url TEXT,
  location TEXT,
  size_range TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  growth_pool_goal BIGINT DEFAULT 0,
  growth_pool_raised BIGINT NOT NULL DEFAULT 0,
  ranking_score INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT SELECT ON public.companies TO anon;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Companies public read" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Owners insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update companies" ON public.companies FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete companies" ON public.companies FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============== JOBS ===============
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies ON DELETE CASCADE,
  posted_by UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  job_type public.job_type NOT NULL DEFAULT 'full_time',
  salary_min INT,
  salary_max INT,
  salary_currency TEXT DEFAULT 'USD',
  skills_required TEXT[] DEFAULT '{}',
  featured BOOLEAN NOT NULL DEFAULT false,
  is_open BOOLEAN NOT NULL DEFAULT true,
  application_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT SELECT ON public.jobs TO anon;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Jobs public read" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Recruiters post jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = posted_by);
CREATE POLICY "Posters update jobs" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = posted_by);
CREATE POLICY "Posters delete jobs" ON public.jobs FOR DELETE TO authenticated USING (auth.uid() = posted_by);
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============== APPLICATIONS ===============
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  cover_letter TEXT,
  status public.application_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, applicant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Applicant or poster reads" ON public.applications FOR SELECT TO authenticated USING (
  auth.uid() = applicant_id OR auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = job_id)
);
CREATE POLICY "Users apply" ON public.applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "Poster updates status" ON public.applications FOR UPDATE TO authenticated USING (
  auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = job_id)
);

CREATE OR REPLACE FUNCTION public.bump_application_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.jobs SET application_count = application_count + 1 WHERE id = NEW.job_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_app_count AFTER INSERT ON public.applications FOR EACH ROW EXECUTE FUNCTION public.bump_application_count();

-- =============== POSTS ===============
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  like_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  share_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT ON public.posts TO anon;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts public" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users create posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors update own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "Authors delete own posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- =============== LIKES ===============
CREATE TABLE public.likes (
  post_id UUID NOT NULL REFERENCES public.posts ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
GRANT SELECT ON public.likes TO anon;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes public read" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users like" ON public.likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike" ON public.likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_like_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_like_counts AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.handle_like_counts();

-- =============== COMMENTS ===============
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;
GRANT SELECT ON public.comments TO anon;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments public read" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users comment" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE OR REPLACE FUNCTION public.handle_comment_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_comment_counts AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_counts();

-- =============== SUBSCRIPTIONS ===============
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subs" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own subs" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own subs" ON public.subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- =============== SONA WALLETS (Stage 1: locked, no transfers) ===============
CREATE TABLE public.sona_wallets (
  user_id UUID PRIMARY KEY REFERENCES public.profiles ON DELETE CASCADE,
  pending_balance BIGINT NOT NULL DEFAULT 0,
  lifetime_earned BIGINT NOT NULL DEFAULT 0,
  airdrop_eligible BOOLEAN NOT NULL DEFAULT false,
  airdrop_claimed BOOLEAN NOT NULL DEFAULT false,
  wallet_address TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sona_wallets TO authenticated;
GRANT ALL ON public.sona_wallets TO service_role;
ALTER TABLE public.sona_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wallet" ON public.sona_wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own wallet" ON public.sona_wallets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own wallet" ON public.sona_wallets FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- =============== REWARD EVENTS (QES tracking) ===============
CREATE TABLE public.reward_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  action TEXT NOT NULL,
  weight INT NOT NULL,
  pool TEXT NOT NULL DEFAULT 'content',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reward_events TO authenticated;
GRANT ALL ON public.reward_events TO service_role;
ALTER TABLE public.reward_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own events" ON public.reward_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own events" ON public.reward_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Bump QES when a reward event lands
CREATE OR REPLACE FUNCTION public.handle_reward_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET qes_score = qes_score + NEW.weight WHERE id = NEW.user_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_reward_event AFTER INSERT ON public.reward_events
FOR EACH ROW EXECUTE FUNCTION public.handle_reward_event();

-- =============== GROWTH POOL CONTRIBUTIONS ===============
CREATE TABLE public.growth_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.growth_contributions TO authenticated;
GRANT SELECT ON public.growth_contributions TO anon;
GRANT ALL ON public.growth_contributions TO service_role;
ALTER TABLE public.growth_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contribs public read" ON public.growth_contributions FOR SELECT USING (true);
CREATE POLICY "Users contribute" ON public.growth_contributions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_growth_contribution()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.companies SET growth_pool_raised = growth_pool_raised + NEW.amount,
    ranking_score = ranking_score + GREATEST(1, (NEW.amount/1000)::int)
    WHERE id = NEW.company_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_growth_contrib AFTER INSERT ON public.growth_contributions
FOR EACH ROW EXECUTE FUNCTION public.handle_growth_contribution();

-- =============== INDEXES ===============
CREATE INDEX idx_posts_author ON public.posts(author_id, created_at DESC);
CREATE INDEX idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX idx_jobs_created ON public.jobs(created_at DESC) WHERE is_open;
CREATE INDEX idx_jobs_company ON public.jobs(company_id);
CREATE INDEX idx_comments_post ON public.comments(post_id, created_at);
CREATE INDEX idx_companies_ranking ON public.companies(ranking_score DESC);
CREATE INDEX idx_profiles_qes ON public.profiles(qes_score DESC);
