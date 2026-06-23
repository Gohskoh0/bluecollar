
-- 1) company_stakes table
CREATE TABLE public.company_stakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount bigint NOT NULL CHECK (amount > 0),
  unstaked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_stakes_company ON public.company_stakes(company_id);
CREATE INDEX idx_company_stakes_user ON public.company_stakes(user_id);

GRANT SELECT ON public.company_stakes TO authenticated;
GRANT ALL ON public.company_stakes TO service_role;

ALTER TABLE public.company_stakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stakes visible to staker or company owner" ON public.company_stakes
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT owner_id FROM public.companies WHERE id = company_stakes.company_id)
  );
-- No INSERT/UPDATE/DELETE policies — all writes go through stake_company_sona().

-- 2) Update handle_reward_event to credit wallet alongside QES
CREATE OR REPLACE FUNCTION public.handle_reward_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET qes_score = qes_score + NEW.weight WHERE id = NEW.user_id;

  INSERT INTO public.sona_wallets (user_id, pending_balance, lifetime_earned)
  VALUES (NEW.user_id, NEW.weight, NEW.weight)
  ON CONFLICT (user_id) DO UPDATE
    SET pending_balance = public.sona_wallets.pending_balance + NEW.weight,
        lifetime_earned = public.sona_wallets.lifetime_earned + NEW.weight,
        updated_at = now();
  RETURN NEW;
END;
$$;

-- 3) Award SONA on post creation (cap 10/day per user)
CREATE OR REPLACE FUNCTION public.award_post_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE today_count int;
BEGIN
  SELECT COUNT(*) INTO today_count
  FROM public.reward_events
  WHERE user_id = NEW.author_id
    AND action = 'post'
    AND created_at >= date_trunc('day', now());
  IF today_count >= 5 THEN
    RETURN NEW; -- 5 posts/day × 2 = 10 SONA cap
  END IF;

  INSERT INTO public.reward_events (user_id, action, weight, pool)
  VALUES (NEW.author_id, 'post', 2, 'content');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_post_reward ON public.posts;
CREATE TRIGGER trg_award_post_reward
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.award_post_reward();

-- 4) Atomic stake function
CREATE OR REPLACE FUNCTION public.stake_company_sona(p_company_id uuid, p_amount bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance bigint;
  v_stake_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  -- Lock wallet row
  SELECT pending_balance INTO v_balance
    FROM public.sona_wallets WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Wallet not initialized'; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient SONA balance'; END IF;

  UPDATE public.sona_wallets
    SET pending_balance = pending_balance - p_amount, updated_at = now()
    WHERE user_id = v_user;

  INSERT INTO public.company_stakes (company_id, user_id, amount)
  VALUES (p_company_id, v_user, p_amount)
  RETURNING id INTO v_stake_id;

  UPDATE public.companies
    SET growth_pool_raised = growth_pool_raised + p_amount,
        ranking_score = ranking_score + GREATEST(1, (p_amount / 100)::int),
        updated_at = now()
    WHERE id = p_company_id;

  RETURN v_stake_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.stake_company_sona(uuid, bigint) TO authenticated;

-- 5) Company SONA multiplier: 1 + log10(1 + active_total/1000)
CREATE OR REPLACE FUNCTION public.company_sona_multiplier(p_company_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 1 + log(10, 1 + COALESCE(SUM(amount), 0)::numeric / 1000)
  FROM public.company_stakes
  WHERE company_id = p_company_id AND unstaked_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.company_sona_multiplier(uuid) TO authenticated, anon;
