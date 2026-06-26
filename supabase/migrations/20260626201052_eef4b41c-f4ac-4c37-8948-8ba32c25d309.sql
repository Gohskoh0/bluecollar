
-- 1) Profiles: drop anon direct read; profiles_public view remains for anon
DROP POLICY IF EXISTS "Profiles public-safe read for anon" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;

-- 2) sona_wallets: remove client-side INSERT/UPDATE; managed by server (service role)
DROP POLICY IF EXISTS "Users insert own wallet" ON public.sona_wallets;
DROP POLICY IF EXISTS "Users update own wallet" ON public.sona_wallets;

-- 3) paystack_transactions: only webhook (service role) can insert
DROP POLICY IF EXISTS "Users insert own txns" ON public.paystack_transactions;

-- 4) Lock SECURITY DEFINER functions to authenticated only
REVOKE ALL ON FUNCTION public.stake_company_sona(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stake_company_sona(uuid, bigint) TO authenticated;

REVOKE ALL ON FUNCTION public.company_sona_multiplier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_sona_multiplier(uuid) TO authenticated;
