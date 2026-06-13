import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coins, Lock, Sparkles, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PLAN_MULTIPLIER, formatRelative } from "@/lib/utils";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "SONA Wallet · BlueCollar" }, { name: "description", content: "Your SONA balance and reward history. Token distribution begins in Stage 2." }] }),
  component: () => (<AppShell><WalletPage /></AppShell>),
});

function WalletPage() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);

  useEffect(() => { if (user) load(); }, [user?.id]);

  async function load() {
    if (!user) return;
    const { data: ev } = await supabase.from("reward_events").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    setEvents(ev ?? []);
    let { data: w } = await supabase.from("sona_wallets").select("*").eq("user_id", user.id).maybeSingle();
    if (!w) {
      const ins = await supabase.from("sona_wallets").insert({ user_id: user.id }).select().single();
      w = ins.data;
    }
    setWallet(w);
  }

  const multiplier = PLAN_MULTIPLIER[profile?.plan ?? "free"] ?? 0;
  const projectedSona = Math.floor((profile?.qes_score ?? 0) * multiplier);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Coins className="h-6 w-6 text-primary" /> SONA Wallet</h1>
        <p className="text-sm text-muted-foreground">Track your earnings from the revenue-backed reward economy.</p>
      </div>

      <Card className="overflow-hidden border-primary/20">
        <div className="bg-gradient-to-br from-primary to-primary-hover p-6 text-primary-foreground">
          <div className="flex items-center justify-between">
            <span className="text-sm opacity-90">Stage 1 — Pending balance</span>
            <Badge variant="secondary" className="gap-1 bg-white/20 text-white border-0"><Lock className="h-3 w-3"/> Locked</Badge>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-5xl font-bold">{projectedSona.toLocaleString()}</span>
            <span className="text-lg opacity-90">SONA</span>
          </div>
          <p className="mt-2 text-sm opacity-90">
            Earned via QES × your plan multiplier ({multiplier}×). Distributed at Stage 2 via on-chain airdrop.
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border bg-card text-center text-sm">
          <div className="p-3"><div className="text-xs text-muted-foreground">QES</div><div className="font-semibold">{profile?.qes_score?.toLocaleString() ?? 0}</div></div>
          <div className="p-3"><div className="text-xs text-muted-foreground">Multiplier</div><div className="font-semibold">{multiplier}×</div></div>
          <div className="p-3"><div className="text-xs text-muted-foreground">Airdrop</div><div className="font-semibold">Stage 2</div></div>
        </div>
      </Card>

      <Card className="border-dashed bg-accent/30 p-4">
        <div className="flex gap-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Stage 2 — SONA Airdrop coming soon</p>
            <p className="mt-1 text-muted-foreground">The SONA token is not yet launched. Continue engaging now — your QES is being tracked and rewards will be distributed via airdrop based on your contribution share. Connect your wallet to be eligible.</p>
            <Button size="sm" variant="outline" className="mt-3" disabled>Connect wallet (coming soon)</Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-primary"/> Recent reward events</div>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet. Engage with the platform to start earning QES.</p>
        ) : (
          <div className="divide-y divide-border">
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium capitalize">{e.action.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">Pool: {e.pool} · {formatRelative(e.created_at)}</div>
                </div>
                <div className="font-semibold text-primary">+{e.weight} QES</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 font-semibold">Pool allocation</h3>
        <div className="space-y-3 text-sm">
          {[
            ["Content Contribution", 40],
            ["Hiring Success", 25],
            ["Skill Validation", 15],
            ["Community Contribution", 10],
            ["Growth Support", 10],
          ].map(([n, v]) => (
            <div key={n as string}>
              <div className="mb-1 flex justify-between text-xs"><span>{n}</span><span className="font-semibold">{v}%</span></div>
              <Progress value={v as number} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
