import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Plus, ShieldCheck, TrendingUp, Coins, Sparkles, Settings, Lock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { stakeInCompany } from "@/lib/stake.functions";
import { getEntitlements } from "@/lib/paystack.functions";
import { COMPANY_LICENSE_CENTS, USD } from "@/lib/feature-gates";

export const Route = createFileRoute("/companies")({
  head: () => ({
    meta: [
      { title: "Companies · Sonari" },
      { name: "description", content: "Discover, support and manage companies on Sonari — stake SONA and grow with them." },
      { property: "og:title", content: "Companies · Sonari" },
      { property: "og:description", content: "Discover, support and manage companies on Sonari — stake SONA and grow with them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <CompaniesPage />
    </AppShell>
  ),
});

function CompaniesPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [licensed, setLicensed] = useState(false);
  const [adminOf, setAdminOf] = useState<Set<string>>(new Set());
  const [stakeOpen, setStakeOpen] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState("100");
  const [staking, setStaking] = useState(false);
  const stake = useServerFn(stakeInCompany);
  const loadEnt = useServerFn(getEntitlements);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [desc, setDesc] = useState("");
  const [industry, setIndustry] = useState("");
  const [goal, setGoal] = useState("");

  useEffect(() => {
    load();
  }, [user?.id]);

  async function load() {
    const { data } = await supabase.from("companies").select("*").order("ranking_score", { ascending: false });
    setCompanies(data ?? []);
    if (user) {
      const [{ data: w }, { data: mem }] = await Promise.all([
        supabase.from("sona_wallets").select("pending_balance").eq("user_id", user.id).maybeSingle(),
        supabase.from("company_members").select("company_id, role, status").eq("user_id", user.id),
      ]);
      setWallet(w);
      const admin = new Set<string>((data ?? []).filter((c: any) => c.owner_id === user.id).map((c: any) => c.id));
      for (const m of mem ?? []) {
        if (["owner", "admin"].includes((m as any).role) && (m as any).status === "active") admin.add((m as any).company_id);
      }
      setAdminOf(admin);
      loadEnt({})
        .then((e: any) => setLicensed(!!e.companyLicense))
        .catch(() => {});
    }
  }

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!licensed) return toast.error("A company licence is required to register a company.");
    const slug =
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("companies").insert({
      owner_id: user.id,
      name,
      slug,
      tagline,
      description: desc,
      industry,
      growth_pool_goal: goal ? Number(goal) : 0,
    });
    if (error) return toast.error(error.message);
    await supabase.from("company_members").insert({ company_id: (await supabase.from("companies").select("id").eq("slug", slug).single()).data!.id, user_id: user.id, role: "owner", title: "Founder", status: "active" } as any);
    toast.success("Company created");
    setOpen(false);
    setName("");
    setTagline("");
    setDesc("");
    setIndustry("");
    setGoal("");
    load();
  }

  async function doStake(companyId: string) {
    if (!user) return toast.error("Sign in first");
    const amt = Math.floor(Number(stakeAmount));
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setStaking(true);
    try {
      await stake({ data: { companyId, amount: amt } });
      toast.success(`Staked ${amt} SONA`);
      setStakeOpen(null);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Stake failed");
    } finally {
      setStaking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-sm text-muted-foreground">Support companies via no-equity Growth Pools, or run your own.</p>
        </div>
        {licensed ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Create company
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create company page</DialogTitle></DialogHeader>
              <form onSubmit={createCompany} className="space-y-3">
                <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
                <div><Label>Tagline</Label><Input value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
                <div><Label>Industry</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="SaaS, Fintech…" /></div>
                <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} /></div>
                <div><Label>Growth Pool goal (SONA)</Label><Input type="number" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="100000" /></div>
                <Button type="submit" className="w-full">Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {user && !licensed && (
        <Card className="border-dashed bg-muted/30 p-4 text-sm">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">Registering a company requires a company licence</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {USD(COMPANY_LICENSE_CENTS)} / month unlocks company registration, employee management, SONA payroll, treasury and
                the full advanced recruiting suite. Available to freelancers and recruiters alike.
              </p>
              <Link to="/subscriptions" className="mt-3 inline-block">
                <Button size="sm">Get company licence</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {companies.length === 0 && (
          <Card className="col-span-full p-10 text-center text-muted-foreground">No companies yet. Be the first to create one.</Card>
        )}
        {companies.map((c) => {
          const pct = c.growth_pool_goal > 0 ? Math.min(100, (c.growth_pool_raised / c.growth_pool_goal) * 100) : 0;
          const canManage = adminOf.has(c.id);
          return (
            <Card key={c.id} className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    {c.verified && (
                      <Badge variant="secondary" className="gap-1">
                        <ShieldCheck className="h-3 w-3" />Verified
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.tagline || c.industry}</p>
                </div>
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="h-3 w-3" /> {c.ranking_score}
                </Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
              {c.growth_pool_goal > 0 && (
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Growth Pool</span>
                    <span className="font-semibold">
                      {c.growth_pool_raised.toLocaleString()} / {c.growth_pool_goal.toLocaleString()} SONA
                    </span>
                  </div>
                  <Progress value={pct} />
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  Multiplier {(1 + Math.log10(1 + c.growth_pool_raised / 1000)).toFixed(2)}×
                </span>
                <div className="flex gap-2">
                  {canManage && (
                    <Link to="/company/$slug" params={{ slug: c.slug }}>
                      <Button size="sm" variant="secondary" className="gap-2">
                        <Settings className="h-4 w-4" /> Manage
                      </Button>
                    </Link>
                  )}
                  <Dialog open={stakeOpen === c.id} onOpenChange={(o) => setStakeOpen(o ? c.id : null)}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-2">
                        <Coins className="h-4 w-4" /> Stake SONA
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Stake SONA in {c.name}</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm">
                          <Sparkles className="h-4 w-4 text-primary" />
                          Your balance: <span className="font-semibold">{Number(wallet?.pending_balance ?? 0).toLocaleString()} SONA</span>
                        </div>
                        <div>
                          <Label>Amount (SONA)</Label>
                          <Input type="number" min={1} value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Staking grows the company's multiplier and ranking. No equity, no securities exposure. You can unstake later.
                        </p>
                        <Button className="w-full" onClick={() => doStake(c.id)} disabled={staking}>
                          {staking ? "Staking…" : `Stake ${stakeAmount || 0} SONA`}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Card className="border-dashed bg-muted/30 p-4 text-xs text-muted-foreground">
        Growth Pool contributions confer no ownership, dividends, or securities exposure.
      </Card>
    </div>
  );
}
