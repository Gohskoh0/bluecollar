import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { getPaystackPublicKey, initializePaystack, verifyPaystack } from "@/lib/paystack.functions";
import { PLAN_PRICE_NGN, PLAN_LABEL } from "@/lib/feature-gates";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({ meta: [{ title: "Subscriptions · Sonari" }, { name: "description", content: "Choose a Sonari plan and unlock monetization." }] }),
  component: () => (<AppShell><SubsPage /></AppShell>),
});

const PRO_PLANS = [
  { id: "free", name: "Free", priceNgn: 0, mult: "0×", features: ["Professional profile", "View jobs", "5 applications / mo", "Post content"] },
  { id: "pro", name: "Pro", priceNgn: PLAN_PRICE_NGN.pro, mult: "1.0×", features: ["Monetization enabled", "25 applications / mo", "Engagement analytics", "Reward pool access"] },
  { id: "expert", name: "Expert", priceNgn: PLAN_PRICE_NGN.expert, mult: "1.5×", featured: true, features: ["Verified badge", "Priority search", "Unlimited applications", "Faster monetization"] },
];

const REC_PLANS = [
  { id: "recruiter_pro", name: "Recruiter Pro", priceNgn: PLAN_PRICE_NGN.recruiter_pro, features: ["Post up to 10 jobs / mo", "Advanced candidate filters", "Direct messaging", "Standard placement"] },
  { id: "recruiter_expert", name: "Recruiter Expert", priceNgn: PLAN_PRICE_NGN.recruiter_expert, featured: true, features: ["Unlimited postings", "Featured placement", "Growth Pool access", "Verified company badge"] },
];

declare global { interface Window { PaystackPop: any } }

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Paystack"));
    document.head.appendChild(s);
  });
}

function SubsPage() {
  const { user, profile, refresh } = useAuth();
  const [pubKey, setPubKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const getKey = useServerFn(getPaystackPublicKey);
  const init = useServerFn(initializePaystack);
  const verify = useServerFn(verifyPaystack);

  useEffect(() => { getKey().then((r) => setPubKey(r.publicKey)); }, []);

  async function choose(plan: string) {
    if (!user) return toast.error("Please sign in");
    if (plan === "free") {
      // Downgrade is instant
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.from("profiles").update({ plan: "free" }).eq("id", user.id);
      if (error) return toast.error(error.message);
      toast.success("Switched to Free");
      refresh();
      return;
    }
    if (!pubKey) return toast.error("Payments not configured yet");
    setBusy(plan);
    try {
      await loadPaystackScript();
      const { reference, amountKobo, email } = await init({ data: { plan } });
      const handler = window.PaystackPop.setup({
        key: pubKey,
        email,
        amount: amountKobo,
        currency: "NGN",
        ref: reference,
        metadata: { plan, user_id: user.id },
        onClose: () => { setBusy(null); },
        callback: (response: any) => {
          (async () => {
            const result = await verify({ data: { reference: response.reference } });
            setBusy(null);
            if (result.ok) {
              toast.success(`Activated ${PLAN_LABEL[result.plan as keyof typeof PLAN_LABEL]}`);
              refresh();
            } else {
              toast.error(result.message ?? "Could not verify payment");
            }
          })();
        },
      });
      handler.openIframe();
    } catch (e: any) {
      setBusy(null);
      toast.error(e?.message ?? "Payment failed to start");
    }
  }

  const fmt = (kobo: number) => kobo === 0 ? "₦0" : `₦${(kobo / 100).toLocaleString()}`;

  function PlanCard({ p }: { p: any }) {
    const current = profile?.plan === p.id;
    const isBusy = busy === p.id;
    return (
      <Card className={`relative p-6 ${p.featured ? "border-primary ring-1 ring-primary/30 shadow-elevated" : ""}`}>
        {p.featured && <Badge className="absolute -top-3 left-6">Most popular</Badge>}
        <h3 className="text-xl font-bold">{p.name}</h3>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold">{fmt(p.priceNgn * 100)}</span>
          <span className="text-sm text-muted-foreground">/mo</span>
        </div>
        {p.mult && <div className="mt-1 text-sm text-primary font-medium">Reward multiplier: {p.mult}</div>}
        <ul className="mt-5 space-y-2 text-sm">
          {p.features.map((f: string) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0" />{f}</li>)}
        </ul>
        <Button onClick={() => choose(p.id)} disabled={current || isBusy} className="mt-6 w-full" variant={p.featured ? "default" : "outline"}>
          {isBusy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Processing…</> :
            current ? <><Star className="mr-2 h-4 w-4"/>Current plan</> : "Choose plan"}
        </Button>
      </Card>
    );
  }

  const isProfessional = profile?.user_type === "professional";
  const isRecruiterOrCompany = profile?.user_type === "recruiter" || profile?.user_type === "company";

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Choose your plan</h1>
        <p className="mt-2 text-muted-foreground">Secure checkout via Paystack — payment runs in-app, no redirects.</p>
      </div>

      {isProfessional && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Plans for Professionals</h2>
          <div className="grid gap-4 md:grid-cols-3">{PRO_PLANS.map((p) => <PlanCard key={p.id} p={p} />)}</div>
        </section>
      )}

      {isRecruiterOrCompany && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">
            Plans for {profile?.user_type === "company" ? "Companies" : "Recruiters"}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">{REC_PLANS.map((p) => <PlanCard key={p.id} p={p} />)}</div>
        </section>
      )}

      {!profile && (
        <p className="text-center text-sm text-muted-foreground">Sign in to view plans available to your account type.</p>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Subscription revenue funds the SONA reward pools — no inflation, only redistribution.
      </p>
    </div>
  );
}
