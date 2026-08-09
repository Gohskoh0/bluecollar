// Server-only fulfilment for Paystack purchases.
// Shared by the client-side verify server fn and the Paystack webhook so both
// paths grant exactly the same entitlements, exactly once.
import { HASH_PACKS } from "./feature-gates";

export type PurchaseKind = `hash:${string}` | "recruiter_pro" | "company_license";

export async function fulfillPurchase(reference: string, raw: unknown) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: txn } = await supabaseAdmin
    .from("paystack_transactions")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (!txn) return { ok: false as const, message: "Transaction not found" };
  if (txn.status === "success") return { ok: true as const, kind: txn.plan, alreadyFulfilled: true };

  await supabaseAdmin
    .from("paystack_transactions")
    .update({ status: "success", paid_at: new Date().toISOString(), raw: raw as any })
    .eq("id", txn.id);

  const kind = txn.plan as string;
  const userId = txn.user_id;

  if (kind.startsWith("hash:")) {
    const packId = kind.slice("hash:".length);
    const pack = HASH_PACKS.find((p) => p.id === packId);
    if (!pack) return { ok: false as const, message: "Unknown hash rate pack" };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("hash_rate, last_mining_claim_at")
      .eq("id", userId)
      .maybeSingle();

    const current = Number((profile as any)?.hash_rate ?? 0);
    await supabaseAdmin
      .from("profiles")
      .update({
        hash_rate: current + pack.ghs,
        // First purchase starts the mining clock now.
        ...((profile as any)?.last_mining_claim_at ? {} : { last_mining_claim_at: new Date().toISOString() }),
      } as any)
      .eq("id", userId);

    await supabaseAdmin.from("hash_rate_purchases").insert({
      user_id: userId,
      pack_id: pack.id,
      ghs: pack.ghs,
      amount_cents: pack.cents,
      currency: "USD",
      reference,
    } as any);

    return { ok: true as const, kind, ghs: pack.ghs };
  }

  if (kind === "recruiter_pro") {
    await supabaseAdmin.from("profiles").update({ plan: "recruiter_pro" }).eq("id", userId);
    await supabaseAdmin.from("subscriptions").insert({ user_id: userId, plan: "recruiter_pro", status: "active" });
    return { ok: true as const, kind };
  }

  if (kind === "company_license") {
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await supabaseAdmin.from("company_licenses").upsert(
      {
        user_id: userId,
        status: "active",
        started_at: now.toISOString(),
        expires_at: expires.toISOString(),
      } as any,
      { onConflict: "user_id" },
    );
    return { ok: true as const, kind };
  }

  return { ok: false as const, message: "Unknown purchase type" };
}
