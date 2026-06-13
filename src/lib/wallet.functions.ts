import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Ensure a custodial Solana devnet wallet exists for the signed-in user.
export const ensureWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("sona_wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.solana_pubkey) {
      const { getBalance } = await import("./solana.server");
      const balance = await getBalance(existing.solana_pubkey);
      return { wallet: existing, solBalance: balance };
    }

    const { generateKeypair, encryptSecret, airdropDevnet, getBalance } = await import("./solana.server");
    const kp = generateKeypair();
    const enc = await encryptSecret(kp.secretKey);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: upserted, error } = await supabaseAdmin
      .from("sona_wallets")
      .upsert(
        {
          user_id: userId,
          solana_pubkey: kp.publicKey,
          encrypted_secret: enc,
          airdrop_eligible_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();
    if (error) throw error;

    // best-effort devnet airdrop
    const sig = await airdropDevnet(kp.publicKey, 0.05);
    if (sig) {
      await supabaseAdmin
        .from("sona_wallets")
        .update({ devnet_funded_at: new Date().toISOString() })
        .eq("user_id", userId);
    }
    const balance = await getBalance(kp.publicKey);
    return { wallet: upserted, solBalance: balance };
  });
