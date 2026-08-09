import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2, Cpu, Zap, Building2, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  getPaystackPublicKey,
  initializePaystack,
  verifyPaystack,
  getEntitlements,
} from "@/lib/paystack.functions";
import {
  HASH_PACKS,
  USD,
  RECRUITER_PRO_CENTS,
  COMPANY_LICENSE_CENTS,
  dailyYield,
} from "@/lib/feature-gates";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({
    meta: [
      { title: "Hash rate & licences · Sonari" },
      { name: "description", content: "Buy mining hash rate, upgrade to Recruiter Pro, or get a Sonari company licence." },
      { property: "og:title", content: "Hash rate & licences · Sonari" },
      { property: "og:description", content: "Buy mining hash rate, upgrade to Recruiter Pro, or get a Sonari company licence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <BillingPage />
    </AppShell>
  ),
});

declare global {
  interface Window {
    PaystackPop: any;
  }
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load the payment window"));
    document.head.appendChild(s);
  });
}

function BillingPage() {
  const { user, profile, refresh } = useAuth();
  const [pubKey, setPubKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [ent, setEnt] = useState<{ companyLicense: boolean; hashRate: number; licenseExpiresAt: string | null } | null>(null);

  const getKey = useServerFn(getPaystackPublicKey);
  const init = useServerFn(initializePaystack);
  const verify = useServerFn(verifyPaystack);
  const loadEnt = useServerFn(getEntitlements);

  useEffect(() => {
    getKey().then((r) => setPubKey(r.publicKey)).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) loadEnt({}).then(setEnt as any).catch(() => {});
  }, [user?.id]);

  async function buy(kind: string, label: string) {
    if (!user) return toast.error("Please sign in first");
    if (!pubKey) return toast.error("Payments are not available right now");
    setBusy(kind);
    try {
      await loadPaystackScript();
      const { reference, amountCents, email } = await init({ data: { kind } });
      const handler = window.PaystackPop.setup({
        key: pubKey,
        email,
        amount: amountCents,
        currency: "USD",
        ref: reference,
        metadata: { kind, user_id: user.id },
        onClose: () => setBusy(null),
        callback: (response: any) => {
          (async () => {
            const result = await verify({ data: { reference: response.reference } });
            setBusy(null);
            if (result.ok) {
              toast.success(`${label} activated`);
              refresh();
              loadEnt({}).then(setEnt as any).catch(() => {});
            } else {
              toast.error(result.message ?? "Could not confirm your payment");
            }
          })();
        },
      });
      handler.openIframe();
    } catch (e: any) {
      setBusy(null);
      toast.error(e?.message ?? "Payment could not be started");
    }
  }

  const isRecruiter = profile ? profile.user_type !== "professional" : false;
  const recruiterPro = profile?.plan === "recruiter_pro" || profile?.plan === "recruiter_expert";

  return (
    <div className="space-y-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Grow your earning power</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          Sonari has no monthly content subscription. You buy <span className="font-medium text-foreground">hash rate</span> once
          and it mines SONA for you — forever.
        </p>
      </div>

      {/* Hash rate */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Cpu className="h-5 w-5 text-primary" /> Mining hash rate
            </h2>
            <p className="text-sm text-muted-foreground">One-time purchase · permanent capacity · claim your yield anytime.</p>
          </div>
          {ent && (
            <Badge variant="secondary" className="gap-1">
              <Zap className="h-3 w-3" /> You own {ent.hashRate.toLocaleString()} GH/s
            </Badge>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HASH_PACKS.map((p) => (
            <Card
              key={p.id}
              className={`relative flex flex-col p-5 ${p.featured ? "border-primary ring-1 ring-primary/30 shadow-elevated" : ""}`}
            >
              {p.featured && <Badge className="absolute -top-3 left-5">Best value</Badge>}
              <h3 className="text-lg font-bold">{p.name}</h3>
              <div className="mt-1 text-3xl font-bold">{USD(p.cents)}</div>
              <div className="mt-1 text-sm font-medium text-primary">{p.ghs.toLocaleString()} GH/s</div>
              <p className="mt-3 flex-1 text-sm text-muted-foreground">{p.blurb}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                <li className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-success" />≈ {dailyYield(p.ghs).toFixed(2)} SONA / day
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-success" />≈ {(dailyYield(p.ghs) * 30).toFixed(0)} SONA / month
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-success" />Stacks with your existing rate
                </li>
              </ul>
              <Button className="mt-5 w-full" variant={p.featured ? "default" : "outline"} disabled={busy === `hash:${p.id}`} onClick={() => buy(`hash:${p.id}`, `${p.ghs} GH/s`)}>
                {busy === `hash:${p.id}` ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…
                  </>
                ) : (
                  "Buy hash rate"
                )}
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* Recruiter + company */}
      <section className="grid gap-4 md:grid-cols-2">
        {isRecruiter && (
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold">Recruiter Pro</h3>
              {recruiterPro && (
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" />Active
                </Badge>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold">{USD(RECRUITER_PRO_CENTS)}</span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {["Unlimited job postings", "Featured job placement", "Advanced candidate filters", "Direct messaging to any professional"].map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-success" />
                  {f}
                </li>
              ))}
            </ul>
            <Button className="mt-5 w-full" disabled={recruiterPro || busy === "recruiter_pro"} onClick={() => buy("recruiter_pro", "Recruiter Pro")}>
              {busy === "recruiter_pro" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…
                </>
              ) : recruiterPro ? (
                "Current plan"
              ) : (
                "Upgrade to Recruiter Pro"
              )}
            </Button>
          </Card>
        )}

        <Card className={`p-6 ${isRecruiter ? "" : "md:col-span-2"}`}>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Company licence</h3>
            {ent?.companyLicense && (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3 w-3" />Active
              </Badge>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold">{USD(COMPANY_LICENSE_CENTS)}</span>
            <span className="text-sm text-muted-foreground">/ month</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Required to register and operate a company on Sonari. Available to freelancers and recruiters alike — inside a company
            you get the full advanced recruiting suite.
          </p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {[
              "Register a company page",
              "Add employees from Sonari",
              "Pay your team in SONA",
              "Company treasury & worth tracking",
              "Advanced recruiting features",
              "Growth Pool & staking access",
            ].map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="h-4 w-4 shrink-0 text-success" />
                {f}
              </li>
            ))}
          </ul>
          {ent?.companyLicense && ent.licenseExpiresAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              Renews {new Date(ent.licenseExpiresAt).toLocaleDateString()}
            </p>
          )}
          <Button
            className="mt-5 w-full sm:w-auto"
            variant={ent?.companyLicense ? "outline" : "default"}
            disabled={busy === "company_license"}
            onClick={() => buy("company_license", "Company licence")}
          >
            {busy === "company_license" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…
              </>
            ) : ent?.companyLicense ? (
              "Extend licence"
            ) : (
              "Get company licence"
            )}
          </Button>
        </Card>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Hash rate and licence revenue funds the SONA reward pools and platform operations — distribution is capped, never inflationary.
      </p>
    </div>
  );
}
