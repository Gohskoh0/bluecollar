import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const stakeInCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; amount: number }) => {
    if (!d?.companyId) throw new Error("companyId required");
    const amount = Math.floor(Number(d.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount must be > 0");
    if (amount > 1_000_000) throw new Error("amount too large");
    return { companyId: d.companyId, amount };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: stakeId, error } = await supabase.rpc("stake_company_sona", {
      p_company_id: data.companyId,
      p_amount: data.amount,
    });
    if (error) throw new Error(error.message);
    return { stakeId };
  });

export const getCompanyMultiplier = createServerFn({ method: "GET" })
  .inputValidator((d: { companyId: string }) => d)
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: mult } = await sb.rpc("company_sona_multiplier", { p_company_id: data.companyId });
    return { multiplier: Number(mult ?? 1) };
  });
