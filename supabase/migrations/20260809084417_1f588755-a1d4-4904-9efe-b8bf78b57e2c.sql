-- ============ USER TYPES: company -> recruiter ============
UPDATE public.profiles SET user_type = 'recruiter' WHERE user_type = 'company';

-- ============ HASH RATES ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hash_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_mining_claim_at timestamptz;

CREATE TABLE public.hash_rate_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pack_id text NOT NULL,
  ghs numeric NOT NULL,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hash_rate_purchases TO authenticated;
GRANT ALL ON public.hash_rate_purchases TO service_role;
ALTER TABLE public.hash_rate_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own hash purchases" ON public.hash_rate_purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.mining_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  hash_rate numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mining_claims TO authenticated;
GRANT ALL ON public.mining_claims TO service_role;
ALTER TABLE public.mining_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mining claims" ON public.mining_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 0.05 SONA per GH/s per day, max 30 days of accrual
CREATE OR REPLACE FUNCTION public.claim_mining_yield()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_rate numeric;
  v_last timestamptz;
  v_days numeric;
  v_amount bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT hash_rate, COALESCE(last_mining_claim_at, created_at)
    INTO v_rate, v_last
  FROM public.profiles WHERE id = v_user FOR UPDATE;

  IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'No hash rate owned'; END IF;

  v_days := LEAST(30, EXTRACT(EPOCH FROM (now() - v_last)) / 86400.0);
  v_amount := floor(v_rate * 0.05 * v_days)::bigint;
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Nothing mined yet'; END IF;

  UPDATE public.profiles SET last_mining_claim_at = now() WHERE id = v_user;

  INSERT INTO public.sona_wallets (user_id, pending_balance, lifetime_earned)
  VALUES (v_user, v_amount, v_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET pending_balance = public.sona_wallets.pending_balance + v_amount,
        lifetime_earned = public.sona_wallets.lifetime_earned + v_amount,
        updated_at = now();

  INSERT INTO public.mining_claims (user_id, amount, hash_rate) VALUES (v_user, v_amount, v_rate);
  RETURN v_amount;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_mining_yield() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_mining_yield() TO authenticated;

-- ============ COMPANY LICENSE ============
CREATE TABLE public.company_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_licenses TO authenticated;
GRANT ALL ON public.company_licenses TO service_role;
ALTER TABLE public.company_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own license" ON public.company_licenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_company_licenses_updated BEFORE UPDATE ON public.company_licenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.has_company_license(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_licenses
    WHERE user_id = _user_id AND status = 'active' AND expires_at > now()
  )
$$;
REVOKE ALL ON FUNCTION public.has_company_license(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_company_license(uuid) TO authenticated;

-- Only licensed users may create a company
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'companies' AND cmd = 'INSERT'
  LOOP EXECUTE format('DROP POLICY %I ON public.companies', r.policyname); END LOOP;
END $$;
CREATE POLICY "Licensed users can create companies" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND public.has_company_license(auth.uid()));

-- ============ COMPANY MEMBERS / PAYROLL ============
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS sona_treasury bigint NOT NULL DEFAULT 0;

CREATE TABLE public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'employee',
  title text,
  salary_sona bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_company_members_updated BEFORE UPDATE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.is_company_admin(_company_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.company_members
                 WHERE company_id = _company_id AND user_id = _user_id
                   AND role IN ('owner','admin') AND status = 'active')
$$;
REVOKE ALL ON FUNCTION public.is_company_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid, uuid) TO authenticated;

CREATE POLICY "members read own team" ON public.company_members
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_company_admin(company_id, auth.uid()));
CREATE POLICY "admins add members" ON public.company_members
  FOR INSERT TO authenticated WITH CHECK (public.is_company_admin(company_id, auth.uid()));
CREATE POLICY "admins update members" ON public.company_members
  FOR UPDATE TO authenticated USING (public.is_company_admin(company_id, auth.uid()));
CREATE POLICY "admins remove members" ON public.company_members
  FOR DELETE TO authenticated USING (public.is_company_admin(company_id, auth.uid()));

CREATE TABLE public.company_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.company_members(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_payments TO authenticated;
GRANT ALL ON public.company_payments TO service_role;
ALTER TABLE public.company_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll visible to admins and payee" ON public.company_payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_company_admin(company_id, auth.uid()));

-- Fund treasury from owner's SONA balance
CREATE OR REPLACE FUNCTION public.fund_company_treasury(p_company_id uuid, p_amount bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_balance bigint; v_new bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF NOT public.is_company_admin(p_company_id, v_user) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT pending_balance INTO v_balance FROM public.sona_wallets WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Wallet not initialized'; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient SONA balance'; END IF;

  UPDATE public.sona_wallets SET pending_balance = pending_balance - p_amount, updated_at = now()
    WHERE user_id = v_user;
  UPDATE public.companies SET sona_treasury = sona_treasury + p_amount, updated_at = now()
    WHERE id = p_company_id RETURNING sona_treasury INTO v_new;
  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.fund_company_treasury(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_company_treasury(uuid, bigint) TO authenticated;

-- Pay an employee in SONA from the company treasury
CREATE OR REPLACE FUNCTION public.pay_employee_sona(p_company_id uuid, p_member_id uuid, p_amount bigint, p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_treasury bigint; v_payee uuid; v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF NOT public.is_company_admin(p_company_id, v_user) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT user_id INTO v_payee FROM public.company_members
    WHERE id = p_member_id AND company_id = p_company_id AND status = 'active';
  IF v_payee IS NULL THEN RAISE EXCEPTION 'Employee not found'; END IF;

  SELECT sona_treasury INTO v_treasury FROM public.companies WHERE id = p_company_id FOR UPDATE;
  IF v_treasury < p_amount THEN RAISE EXCEPTION 'Insufficient company treasury'; END IF;

  UPDATE public.companies SET sona_treasury = sona_treasury - p_amount, updated_at = now()
    WHERE id = p_company_id;

  INSERT INTO public.sona_wallets (user_id, pending_balance, lifetime_earned)
  VALUES (v_payee, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET pending_balance = public.sona_wallets.pending_balance + p_amount,
        lifetime_earned = public.sona_wallets.lifetime_earned + p_amount,
        updated_at = now();

  INSERT INTO public.company_payments (company_id, member_id, user_id, amount, note)
  VALUES (p_company_id, p_member_id, v_payee, p_amount, p_note)
  RETURNING id INTO v_id;

  PERFORM public.create_notification(v_payee, v_user, 'salary_paid', 'company', p_company_id,
    jsonb_build_object('amount', p_amount, 'note', p_note));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.pay_employee_sona(uuid, uuid, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_employee_sona(uuid, uuid, bigint, text) TO authenticated;

-- Total company worth in SONA
CREATE OR REPLACE FUNCTION public.company_worth(p_company_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(c.sona_treasury, 0) + COALESCE(c.growth_pool_raised, 0)
       + COALESCE((SELECT SUM(amount) FROM public.company_stakes s
                   WHERE s.company_id = c.id AND s.unstaked_at IS NULL), 0)
  FROM public.companies c WHERE c.id = p_company_id
$$;
REVOKE ALL ON FUNCTION public.company_worth(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_worth(uuid) TO authenticated;