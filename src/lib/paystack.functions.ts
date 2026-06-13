import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { PLAN_PRICE_NGN } from "./feature-gates";

const PlanSchema = z.enum(["pro", "expert", "recruiter_pro", "recruiter_expert"]);

// Returns the publishable key the client needs to load Paystack Inline.
export const getPaystackPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? "" };
});

// Initialize an inline transaction: creates a pending row and returns a reference + email.
// We use Paystack Inline (popup) on the client, so this server fn only registers the
// pending transaction. Verification happens in /verify or via webhook.
export const initializePaystack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan: string }) => ({ plan: PlanSchema.parse(d.plan) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const amountKobo = PLAN_PRICE_NGN[data.plan] * 100;
    const reference = `bc_${userId.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const { data: row, error } = await supabase
      .from("paystack_transactions")
      .insert({
        user_id: userId,
        reference,
        amount_kobo: amountKobo,
        plan: data.plan,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw error;

    const { data: { user } } = await supabase.auth.getUser();
    return { reference: row.reference, amountKobo, email: user?.email ?? "" };
  });

// Server-side verification by calling Paystack API after the client-side popup closes.
export const verifyPaystack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reference: string }) => ({ reference: z.string().min(5).max(120).parse(d.reference) }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Paystack not configured");
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json: any = await res.json();
    if (!json?.status || json.data?.status !== "success") {
      return { ok: false, message: json?.message ?? "Verification failed" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: txn } = await supabaseAdmin
      .from("paystack_transactions")
      .select("*")
      .eq("reference", data.reference)
      .maybeSingle();
    if (!txn || txn.user_id !== userId) return { ok: false, message: "Transaction not found" };

    await supabaseAdmin
      .from("paystack_transactions")
      .update({ status: "success", paid_at: new Date().toISOString(), raw: json.data })
      .eq("id", txn.id);

    const planTyped = txn.plan as "pro" | "expert" | "recruiter_pro" | "recruiter_expert";
    await supabaseAdmin.from("profiles").update({ plan: planTyped }).eq("id", userId);
    await supabaseAdmin
      .from("subscriptions")
      .insert({ user_id: userId, plan: planTyped, status: "active" });

    return { ok: true, plan: planTyped };
  });
