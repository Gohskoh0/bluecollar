import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Briefcase, Building2, Coins, ShieldCheck, TrendingUp, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/sonari-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sonari — The Professional Economy Network" },
      {
        name: "description",
        content:
          "Professional networking, jobs, and a revenue-backed reward economy. Build your career and earn from real platform revenue with SONA.",
      },
      { property: "og:title", content: "Sonari — The Professional Economy Network" },
      {
        property: "og:description",
        content:
          "Where your professional contribution builds real, measurable value.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: "/feed" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/feed" });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Sonari" className="h-9 w-9" width={36} height={36} />
            <span className="text-lg font-bold tracking-tight text-foreground">Sonari</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link to="/auth" search={{ mode: "signup" } as never}>
              <Button>Join now</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent via-background to-background" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Coins className="h-3.5 w-3.5" /> Powered by the SONA Economy
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl">
              The Professional <span className="text-primary">Economy Network</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Sonari combines professional networking, a job marketplace, and a revenue-backed
              reward economy. Where your contribution builds real, measurable value.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" search={{ mode: "signup" } as never}>
                <Button size="lg" className="gap-2">
                  Get started <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/jobs">
                <Button size="lg" variant="outline">
                  Browse jobs
                </Button>
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> KYC-verified</div>
              <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Revenue-backed rewards</div>
              <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Reputation system</div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-2xl" />
            <div className="relative rounded-2xl border border-border bg-card p-6 shadow-elevated">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <img src={logo} alt="" className="h-10 w-10" />
                  <div>
                    <div className="font-semibold">Monthly Reward Pool</div>
                    <div className="text-xs text-muted-foreground">Backed by platform revenue</div>
                  </div>
                </div>
                <span className="rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success">Live</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                {[
                  { label: "Content Pool", value: "40%" },
                  { label: "Hiring Pool", value: "25%" },
                  { label: "Skill Pool", value: "15%" },
                  { label: "Community", value: "10%" },
                ].map((p) => (
                  <div key={p.label} className="rounded-lg bg-muted/50 p-3">
                    <div className="text-2xl font-bold text-primary">{p.value}</div>
                    <div className="text-xs text-muted-foreground">{p.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">$520k</strong> example monthly revenue → <strong className="text-foreground">$156k</strong> reward pool distributed via QES.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
          Four layers. One economy.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Sonari redistributes platform revenue back to the professionals who create the value.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Users, t: "Identity", d: "Verified profiles, reputation scoring, and KYC-backed trust." },
            { icon: Briefcase, t: "Marketplace", d: "Jobs, candidate discovery, and recruiter tools." },
            { icon: TrendingUp, t: "Engagement", d: "Posts, discussions, and a Qualified Engagement Score." },
            { icon: Coins, t: "Economy", d: "Subscriptions fund SONA reward pools, transparently." },
          ].map((p) => (
            <div key={p.t} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{p.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section className="bg-accent/40 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
            Plans that pay you back
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Subscription revenue funds the reward pools. Eligible members earn from real income.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { name: "Pro", price: "$9.99", mult: "1.0×", perks: ["Monetization enabled", "Engagement analytics", "Profile visibility boost"] },
              { name: "Expert", price: "$24.99", mult: "1.5×", featured: true, perks: ["Verified badge", "Priority search ranking", "Faster monetization"] },
              { name: "Recruiter Expert", price: "$199", mult: "—", perks: ["Unlimited postings", "Featured placements", "Growth Pool access"] },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border bg-card p-6 ${plan.featured ? "border-primary shadow-elevated ring-1 ring-primary/30" : "border-border shadow-card"}`}
              >
                {plan.featured && (
                  <span className="mb-3 inline-block rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    Most popular
                  </span>
                )}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <div className="mt-1 text-sm text-primary font-medium">Reward multiplier: {plan.mult}</div>
                <ul className="mt-5 space-y-2 text-sm">
                  {plan.perks.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="text-muted-foreground">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <Building2 className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
          Your contribution. Real value.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Join professionals, recruiters, and companies on the network where engagement is rewarded
          from real platform revenue — not token inflation.
        </p>
        <div className="mt-8">
          <Link to="/auth" search={{ mode: "signup" } as never}>
            <Button size="lg" className="gap-2">
              Create your profile <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-6 w-6" />
            <span>© {new Date().getFullYear()} Sonari</span>
          </div>
          <div className="text-xs">Stage 1 — SONA token launch coming in Stage 2 via community airdrop.</div>
        </div>
      </footer>
    </div>
  );
}
