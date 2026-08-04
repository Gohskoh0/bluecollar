import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Lock, Sparkles, TrendingUp, ArrowUpRight, ArrowDownLeft, Repeat } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ensureWallet } from "@/lib/wallet.functions";
import { formatRelative } from "@/lib/utils";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "SONA Wallet · Sonari" }, { name: "description", content: "Your SONA wallet — balance, rewards, and staking." }] }),
  component: () => (<AppShell><WalletPage /></AppShell>),
});

function WalletPage() {
  const { user } = useAuth();
  const ensure = useServerFn(ensureWallet);
  const [events, setEvents] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [stakes, setStakes] = useState<any[]>([]);

  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user?.id]);

  async function load() {
    if (!user) return;
    try {
      const res: any = await (ensure as any)();
      setWallet(res.wallet);
      setSolBalance(res.solBalance ?? 0);
    } catch (e) { /* ignore */ }
    const { data: ev } = await supabase.from("reward_events").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    setEvents(ev ?? []);
    const { data: st } = await supabase.from("company_stakes").select("*, companies(name, slug)").eq("user_id", user.id).order("created_at", { ascending: false });
    setStakes(st ?? []);
  }

  const pending = Number(wallet?.pending_balance ?? 0);
  const lifetime = Number(wallet?.lifetime_earned ?? 0);

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Coins className="h-6 w-6 text-primary" /> SONA Wallet</h1>
          <p className="text-sm text-muted-foreground">Earn SONA from activity. Stake into companies. Balance unlocks at mainnet launch.</p>
        </div>

        <Card className="overflow-hidden border-primary/20">
          <div className="bg-gradient-to-br from-primary to-primary-hover p-6 text-primary-foreground">
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-90">SONA Balance</span>
              <Badge variant="secondary" className="gap-1 bg-white/20 text-white border-0"><Lock className="h-3 w-3"/> Locked</Badge>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-5xl font-bold">{pending.toLocaleString()}</span>
              <span className="text-lg opacity-90">SONA</span>
            </div>
            <p className="mt-2 text-xs opacity-90">Lifetime earned: {lifetime.toLocaleString()} SONA · SOL: {solBalance.toFixed(4)}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { icon: ArrowUpRight, label: "Send" },
                { icon: ArrowDownLeft, label: "Receive" },
                { icon: Repeat, label: "Swap" },
              ].map(({ icon: Icon, label }) => (
                <Tooltip key={label}>
                  <TooltipTrigger asChild>
                    <span>
                      <Button size="sm" variant="secondary" className="w-full bg-white/15 text-white hover:bg-white/20 border-0" disabled>
                        <Icon className="h-4 w-4 mr-1" /> {label}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Available at mainnet launch</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
          {wallet?.solana_pubkey && (
            <div className="border-t border-border bg-card p-3 text-center text-xs text-muted-foreground break-all">
              Wallet address: <span className="font-mono">{wallet.solana_pubkey}</span>
            </div>
          )}
        </Card>

        <Card className="border-dashed bg-accent/30 p-4">
          <div className="flex gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">Earn SONA every day</p>
              <p className="mt-1 text-muted-foreground">Post, comment, get likes, apply to jobs — every activity adds SONA to your balance. Stake into companies you believe in to grow with them.</p>
            </div>
          </div>
        </Card>

        {stakes.length > 0 && (
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-primary"/> Your stakes</div>
            <div className="divide-y divide-border">
              {stakes.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{s.companies?.name ?? "Company"}</div>
                    <div className="text-xs text-muted-foreground">{formatRelative(s.created_at)}</div>
                  </div>
                  <div className="font-semibold text-primary">{Number(s.amount).toLocaleString()} SONA</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-primary"/> Recent reward events</div>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet. Engage with the platform to start earning SONA.</p>
          ) : (
            <div className="divide-y divide-border">
              {events.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium capitalize">{e.action.replace(/_/g, " ")}</div>
                    <div className="text-xs text-muted-foreground">Pool: {e.pool} · {formatRelative(e.created_at)}</div>
                  </div>
                  <div className="font-semibold text-primary">+{e.weight} SONA</div>
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
    </TooltipProvider>
  );
}
