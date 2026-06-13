
-- Paystack transactions
CREATE TABLE public.paystack_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  amount_kobo BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.paystack_transactions TO authenticated;
GRANT ALL ON public.paystack_transactions TO service_role;
ALTER TABLE public.paystack_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own txns" ON public.paystack_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own txns" ON public.paystack_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_paystack_txn_user ON public.paystack_transactions(user_id);
CREATE INDEX idx_paystack_txn_ref ON public.paystack_transactions(reference);

-- Extend sona_wallets with custodial Solana fields if not present
ALTER TABLE public.sona_wallets
  ADD COLUMN IF NOT EXISTS solana_pubkey TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_secret TEXT,
  ADD COLUMN IF NOT EXISTS airdrop_eligible_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS devnet_funded_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sona_wallet_pubkey ON public.sona_wallets(solana_pubkey) WHERE solana_pubkey IS NOT NULL;
