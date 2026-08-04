import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Plus, ShieldCheck, TrendingUp, Coins, Sparkles } from "lucide-react";
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

export const Route = createFileRoute("/companies")({
  head: () => ({ meta: [{ title: "Companies · Sonari" }, { name: "description", content: "Discover and support companies on Sonari." }] }),
  component: () => (<AppShell><CompaniesPage /></AppShell>),
});

function CompaniesPage() {
  const { user, profile } = useAuth();
  const canCreate = !!profile && profile.user_type !== "professional";
  const [companies, setCompanies] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [stakeOpen, setStakeOpen] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState("100");
  const [staking, setStaking] = useState(false);
  const stake = useServerFn(stakeInCompany);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [tagline, setTagline] = useState("");
  const [desc, setDesc] = useState(""); const [industry, setIndustry] = useState("");
  const [goal, setGoal] = useState("");

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  async function load() {
    const { data } = await supabase.from("companies").select("*").order("ranking_score", { ascending: false });
    setCompanies(data ?? []);
    if (user) {
      const { data: w } = await supabase.from("sona_wallets").select("pending_balance").eq("user_id", user.id).maybeSingle();
      setWallet(w);
    }
  }

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!canCreate) return toast.error("Only employer/company accounts can create a company page.");
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("companies").insert({
      owner_id: user.id, name, slug, tagline, description: desc, industry, growth_pool_goal: goal ? Number(goal) : 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Company created");
    setOpen(false); setName(""); setTagline(""); setDesc(""); setIndustry(""); setGoal("");
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
    } finally { setStaking(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-sm text-muted-foreground">Support companies via no-equity Growth Pools.</p>
        </div>
        {canCreate ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Create company</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create company page</DialogTitle></DialogHeader>
              <form onSubmit={createCompany} className="space-y-3">
                <div><Label>Name</Label><Input value={name} onChange={(e)=>setName(e.target.value)} required /></div>
                <div><Label>Tagline</Label><Input value={tagline} onChange={(e)=>setTagline(e.target.value)} /></div>
                <div><Label>Industry</Label><Input value={industry} onChange={(e)=>setIndustry(e.target.value)} placeholder="SaaS, Fintech…" /></div>
                <div><Label>Description</Label><Textarea value={desc} onChange={(e)=>setDesc(e.target.value)} rows={4} /></div>
                <div><Label>Growth Pool goal (SONA)</Label><Input type="number" value={goal} onChange={(e)=>setGoal(e.target.value)} placeholder="100000" /></div>
                <Button type="submit" className="w-full">Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {profile && !canCreate && (
        <Card className="border-dashed bg-muted/30 p-4 text-sm">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <div className="font-medium">Creating a company is for employer accounts</div>
              <p className="mt-0.5 text-xs text-muted-foreground">Your account is set to <span className="font-semibold">{profile.user_type}</span>. Switch your account type to <span className="font-semibold">recruiter</span> or <span className="font-semibold">company</span> from your profile settings to create and manage a company page. You can still discover and support companies below.</p>
            </div>
          </div>
        </Card>
      )}


      <div className="grid gap-4 md:grid-cols-2">
        {companies.length === 0 && <Card className="col-span-full p-10 text-center text-muted-foreground">No companies yet. Be the first to create one.</Card>}
        {companies.map((c) => {
          const pct = c.growth_pool_goal > 0 ? Math.min(100, (c.growth_pool_raised / c.growth_pool_goal) * 100) : 0;
          return (
            <Card key={c.id} className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    {c.verified && <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3"/>Verified</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.tagline || c.industry}</p>
                </div>
                <Badge variant="outline" className="gap-1"><TrendingUp className="h-3 w-3"/> {c.ranking_score}</Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
              {c.growth_pool_goal > 0 && (
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Growth Pool</span>
                    <span className="font-semibold">{c.growth_pool_raised.toLocaleString()} / {c.growth_pool_goal.toLocaleString()} SONA</span>
                  </div>
                  <Progress value={pct} />
                </div>
              )}
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Multiplier {((1 + Math.log10(1 + c.growth_pool_raised / 1000))).toFixed(2)}×</span>
                <Dialog open={stakeOpen === c.id} onOpenChange={(o) => setStakeOpen(o ? c.id : null)}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2"><Coins className="h-4 w-4" /> Stake SONA</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Stake SONA in {c.name}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="rounded-md bg-muted p-3 text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Your balance: <span className="font-semibold">{Number(wallet?.pending_balance ?? 0).toLocaleString()} SONA</span>
                      </div>
                      <div>
                        <Label>Amount (SONA)</Label>
                        <Input type="number" min={1} value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} />
                      </div>
                      <p className="text-xs text-muted-foreground">Staking grows the company's multiplier and ranking. No equity, no securities exposure. You can unstake later.</p>
                      <Button className="w-full" onClick={() => doStake(c.id)} disabled={staking}>
                        {staking ? "Staking…" : `Stake ${stakeAmount || 0} SONA`}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </Card>
          );
        })}
      </div>
      <Card className="border-dashed bg-muted/30 p-4 text-xs text-muted-foreground">
        Growth Pool contributions confer no ownership, dividends, or securities exposure. Token distribution begins in Stage 2 via airdrop.
      </Card>
    </div>
  );
}
