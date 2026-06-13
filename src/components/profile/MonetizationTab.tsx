import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, TrendingUp, Sparkles, Lock, ArrowUpRight, Wallet, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getFeatures, PLAN_MULTIPLIER, PLAN_LABEL } from "@/lib/feature-gates";
import { ACTION_WEIGHTS, formatRelative } from "@/lib/utils";
import { ensureWallet } from "@/lib/wallet.functions";

export function MonetizationTab() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [solBalance, setSolBalance] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const ensure = useServerFn(ensureWallet);

  useEffect(() => { if (user) load(); }, [user?.id]);

  async function load() {
    if (!user) return;
    const [{ data: ev }, { data: w }] = await Promise.all([
      supabase.from("reward_events").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(15),
      supabase.from("sona_wallets").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setEvents(ev ?? []);
    setWallet(w);
  }

  async function provisionWallet() {
    setBusy(true);
    try {
      const res = await ensure({});
      setWallet(res.wallet);
      setSolBalance(res.solBalance);
      toast.success("Custodial Solana devnet wallet ready");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to provision wallet");
    } finally { setBusy(false); }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!profile) return null;
  const features = getFeatures(profile);
  const multiplier = PLAN_MULTIPLIER[profile.plan];
  const projectedSona = Math.floor((profile.qes_score ?? 0) * multiplier);
  const monetizationOn = features.monetizationEnabled;

  return (
    <div className="space-y-4">
      {/* Earnings hero */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary via-primary-hover to-primary p-6 text-primary-foreground">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
                <Coins className="h-3.5 w-3.5" /> Pending SONA balance · Stage 1
              </div>
              <div className="mt-2 text-5xl font-bold">{wallet?.pending_balance?.toLocaleString() ?? 0}</div>
              <div className="mt-1 text-sm opacity-90">≈ {projectedSona.toLocaleString()} SONA projected from your QES</div>
            </div>
            <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3"/>{PLAN_LABEL[profile.plan]}</Badge>
          </div>
          <div className="relative mt-6 grid grid-cols-3 gap-3 text-sm">
            <div><div className="opacity-70 text-xs">QES Score</div><div className="text-xl font-semibold">{(profile.qes_score ?? 0).toLocaleString()}</div></div>
            <div><div className="opacity-70 text-xs">Multiplier</div><div className="text-xl font-semibold">{multiplier}×</div></div>
            <div><div className="opacity-70 text-xs">Status</div><div className="text-xl font-semibold">{monetizationOn ? "Active" : "Locked"}</div></div>
          </div>
        </div>
      </Card>

      {!monetizationOn && (
        <Card className="border-warning/30 bg-warning/5 p-5">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">Monetization is locked on the Free plan</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Upgrade to Pro or Expert to enable rewards, get higher search visibility, and unlock the reward pool.
              </p>
              <div className="mt-3 flex gap-2">
                <Link to="/subscriptions"><Button size="sm" className="gap-2">Upgrade plan <ArrowUpRight className="h-3.5 w-3.5"/></Button></Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Custodial Solana wallet */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Solana devnet wallet</h3>
            <Badge variant="outline" className="text-[10px]">devnet</Badge>
          </div>
          {wallet?.solana_pubkey ? (
            <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" />Provisioned</Badge>
          ) : (
            <Button size="sm" onClick={provisionWallet} disabled={busy}>{busy ? "Creating…" : "Provision wallet"}</Button>
          )}
        </div>
        {wallet?.solana_pubkey && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs">
              <span className="truncate flex-1">{wallet.solana_pubkey}</span>
              <button onClick={() => copy(wallet.solana_pubkey)} className="text-muted-foreground hover:text-foreground">
                {copied ? <Check className="h-3.5 w-3.5"/> : <Copy className="h-3.5 w-3.5"/>}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              SONA will be airdropped to this address at Stage 2 launch. Stage 1 tracks pending balance only.
            </p>
          </div>
        )}
      </Card>

      {/* Engagement weights — moved here from home page */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary"/>
          <h3 className="font-semibold">SONA economy — engagement weights</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Every verified action adds to your Qualified Engagement Score. Rewards are funded by real platform revenue — no inflationary minting.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(ACTION_WEIGHTS).map(([action, { weight, pool }]) => (
            <div key={action} className="rounded-lg border border-border bg-card/50 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{action.replace(/_/g, " ")}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg font-bold text-primary">+{weight}</span>
                <span className="text-xs text-muted-foreground">QES</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{pool} pool</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent activity */}
      <Card className="p-5">
        <h3 className="mb-3 font-semibold">Recent reward activity</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reward events yet. Post, comment, and apply to start earning QES.</p>
        ) : (
          <div className="divide-y divide-border">
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium capitalize">{e.action_type?.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">{formatRelative(e.created_at)} · {e.pool} pool</div>
                </div>
                <div className="font-semibold text-primary">+{e.weight} QES</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
