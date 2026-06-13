import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Plus, ShieldCheck, TrendingUp, Coins } from "lucide-react";
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

export const Route = createFileRoute("/companies")({
  head: () => ({ meta: [{ title: "Companies · BlueCollar" }, { name: "description", content: "Discover and support companies on BlueCollar." }] }),
  component: () => (<AppShell><CompaniesPage /></AppShell>),
});

function CompaniesPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [tagline, setTagline] = useState("");
  const [desc, setDesc] = useState(""); const [industry, setIndustry] = useState("");
  const [goal, setGoal] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("companies").select("*").order("ranking_score", { ascending: false });
    setCompanies(data ?? []);
  }

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("companies").insert({
      owner_id: user.id, name, slug, tagline, description: desc, industry, growth_pool_goal: goal ? Number(goal) : 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Company created");
    setOpen(false); setName(""); setTagline(""); setDesc(""); setIndustry(""); setGoal("");
    load();
  }

  async function contribute(companyId: string) {
    if (!user) return;
    const amount = 100; // demo Stage 1: locked SONA contribution
    const { error } = await supabase.from("growth_contributions").insert({ company_id: companyId, user_id: user.id, amount });
    if (error) return toast.error(error.message);
    toast.success(`Pledged ${amount} SONA (locked, distributed at Stage 2)`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-sm text-muted-foreground">Support companies via no-equity Growth Pools.</p>
        </div>
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
      </div>

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
              <div className="mt-4 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => contribute(c.id)} className="gap-2">
                  <Coins className="h-4 w-4" /> Pledge 100 SONA
                </Button>
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
