import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return new Response("Not configured", { status: 500 });
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const body = await request.text();
        const expected = createHmac("sha512", secret).update(body).digest("hex");
        const a = Buffer.from(signature); const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }
        const event = JSON.parse(body);
        if (event.event === "charge.success") {
          const reference = event.data?.reference;
          if (!reference) return new Response("ok");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: txn } = await supabaseAdmin
            .from("paystack_transactions")
            .select("*")
            .eq("reference", reference)
            .maybeSingle();
          if (txn && txn.status !== "success") {
            const planTyped = txn.plan as "pro" | "expert" | "recruiter_pro" | "recruiter_expert";
            await supabaseAdmin.from("paystack_transactions").update({
              status: "success",
              paid_at: new Date().toISOString(),
              raw: event.data,
            }).eq("id", txn.id);
            await supabaseAdmin.from("profiles").update({ plan: planTyped }).eq("id", txn.user_id);
            await supabaseAdmin.from("subscriptions").insert({ user_id: txn.user_id, plan: planTyped, status: "active" });
          }
        }
        return new Response("ok");
      },
    },
  },
});
