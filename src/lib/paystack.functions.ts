import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { COMPANY_LICENSE_CENTS, RECRUITER_PRO_CENTS, findHashPack } from "./feature-gates";

const KindSchema = z.union([
  z.string().regex(/^hash:[a-z0-9_-]{2,32}$/),
  z.literal("recruiter_pro"),
  z.literal("company_license"),
]);

// Returns the publishable key the client needs to load Paystack Inline.
export const getPaystackPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? "" };
});

function priceFor(kind: string): number {
  if (kind.startsWith("hash:")) {
    const pack = findHashPack(kind.slice("hash:".length));
    if (!pack) throw new Error("Unknown hash rate pack");
    return pack.cents;
  }
  if (kind === "recruiter_pro") return RECRUITER_PRO_CENTS;
  if (kind === "company_license") return COMPANY_LICENSE_CENTS;
  throw new Error("Unknown purchase");
}

/**
 * Registers a pending transaction and returns what Paystack Inline needs.
 * Amounts are USD cents. Entitlements are granted only after verification.
 */
export const initializePaystack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: string }) => ({ kind: KindSchema.parse(d.kind) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", userId)
      .maybeSingle();
    if (pErr || !profile) throw new Error("Profile not found");

    if (data.kind === "recruiter_pro" && profile.user_type === "professional") {
      throw new Error("Recruiter Pro is only available for recruiter accounts.");
    }

    const amountCents = priceFor(data.kind);
    const reference = `sn_${userId.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const { data: row, error } = await supabase
      .from("paystack_transactions")
      .insert({
        user_id: userId,
        reference,
        amount_kobo: amountCents,
        currency: "USD",
        plan: data.kind,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw error;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { reference: row.reference, amountCents, email: user?.email ?? "" };
  });

/** Verifies with Paystack, then grants the entitlement. */
export const verifyPaystack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reference: string }) => ({ reference: z.string().min(5).max(120).parse(d.reference) }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payments are not configured");

    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json: any = await res.json();
    if (!json?.status || json.data?.status !== "success") {
      return { ok: false as const, message: json?.message ?? "Verification failed" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: txn } = await supabaseAdmin
      .from("paystack_transactions")
      .select("user_id")
      .eq("reference", data.reference)
      .maybeSingle();
    if (!txn || txn.user_id !== userId) return { ok: false as const, message: "Transaction not found" };

    const { fulfillPurchase } = await import("./fulfillment.server");
    return await fulfillPurchase(data.reference, json.data);
  });

/** Current paid entitlements for the signed-in user. */
export const getEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: license }, { data: profile }] = await Promise.all([
      supabase.from("company_licenses").select("status, expires_at").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("hash_rate, last_mining_claim_at").eq("id", userId).maybeSingle(),
    ]);

    const companyLicense =
      !!license && (license as any).status === "active" && new Date((license as any).expires_at) > new Date();

    return {
      companyLicense,
      licenseExpiresAt: (license as any)?.expires_at ?? null,
      hashRate: Number((profile as any)?.hash_rate ?? 0),
      lastMiningClaimAt: (profile as any)?.last_mining_claim_at ?? null,
    };
  });

/** Converts accrued mining yield into pending SONA. */
export const claimMining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("claim_mining_yield" as any);
    if (error) throw new Error(error.message);
    return { amount: Number(data ?? 0) };
  });
