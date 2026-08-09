import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, TrendingUp, Sparkles, ArrowUpRight, Wallet, Copy, Check, Cpu, Zap } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { dailyYield, MINING_RATE_PER_GHS_PER_DAY } from "@/lib/feature-gates";
import { ACTION_WEIGHTS, formatRelative } from "@/lib/utils";
import { ensureWallet } from "@/lib/wallet.functions";
import { getEntitlements, claimMining } from "@/lib/paystack.functions";

export function MonetizationTab() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [ent, setEnt] = useState<{ hashRate: number; lastMiningClaimAt: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [mining, setMining] = useState(false);
  const [copied, setCopied] = useState(false);

  const ensure = useServerFn(ensureWallet);
  const loadEnt = useServerFn(getEntitlements);
  const claim = useServerFn(claimMining);

  useEffect(() => {
    if (user) load();
  }, [user?.id]);

  async function load() {
    if (!user) return;
    const [{ data: ev }, { data: w }, { data: mc }] = await Promise.all([
      supabase.from("reward_events").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(15),
      supabase.from("sona_wallets").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("mining_claims").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    ]);
    setEvents(ev ?? []);
    setWallet(w);
    setClaims(mc ?? []);
    loadEnt({}).then(setEnt as any).catch(() => {});
  }

  async function provisionWallet() {
    setBusy(true);
    try {
      const res = await ensure({});
      setWallet(res.wallet);
      toast.success("Your Sonari wallet is ready");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create your wallet");
    } finally {
      setBusy(false);
    }
  }

  async function doClaim() {
    setMining(true);
    try {
      const { amount } = await claim({});
      toast.success(`Mined ${amount.toLocaleString()} SONA`);
      load();
    } catch (e: any) {
      toast.error(e?.message?.replace(/^.*Error:\s*/, "") ?? "Nothing to claim yet");
    } finally {
      setMining(false);
    }
  }

  if (!profile) return null;

  const hashRate = ent?.hashRate ?? 0;
  const perDay = dailyYield(hashRate);
  const since = ent?.lastMiningClaimAt ? new Date(ent.lastMiningClaimAt) : null;
  const days = since ? Math.min(30, (Date.now() - since.getTime()) / 86_400_000) : 0;
  const accrued = Math.floor(perDay * days);

  return (
    <div className="space-y-4">
      {/* Earnings hero */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary via-primary-hover to-primary p-6 text-primary-foreground">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
                <Coins className="h-3.5 w-3.5" /> SONA balance
              </div>
              <div className="mt-2 text-5xl font-bold">{Number(wallet?.pending_balance ?? 0).toLocaleString()}</div>
              <div className="mt-1 text-sm opacity-90">Lifetime earned {Number(wallet?.lifetime_earned ?? 0).toLocaleString()} SONA</div>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              {hashRate.toLocaleString()} GH/s
            </Badge>
          </div>
          <div className="relative mt-6 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs opacity-70">QES Score</div>
              <div className="text-xl font-semibold">{(profile.qes_score ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs opacity-70">Mining / day</div>
              <div className="text-xl font-semibold">{perDay.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs opacity-70">Unclaimed</div>
              <div className="text-xl font-semibold">{accrued.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Hash rate mining */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Hash rate mining</h3>
          </div>
          <div className="flex gap-2">
            {hashRate > 0 && (
              <Button size="sm" onClick={doClaim} disabled={mining || accrued < 1} className="gap-2">
                <Zap className="h-4 w-4" />
                {mining ? "Claiming…" : accrued < 1 ? "Nothing to claim" : `Claim ${accrued.toLocaleString()} SONA`}
              </Button>
            )}
            <Link to="/subscriptions">
              <Button size="sm" variant="outline" className="gap-2">
                {hashRate > 0 ? "Add hash rate" : "Buy hash rate"} <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Hash rate is a one-time purchase that mines SONA continuously at {MINING_RATE_PER_GHS_PER_DAY} SONA per GH/s per day.
          Yield accrues for up to 30 days — claim regularly so nothing is lost.
        </p>
        {claims.length > 0 && (
          <div className="mt-3 divide-y divide-border text-sm">
            {claims.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">{formatRelative(c.created_at)} · {Number(c.hash_rate).toLocaleString()} GH/s</span>
                <span className="font-semibold text-primary">+{Number(c.amount).toLocaleString()} SONA</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Wallet */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Sonari wallet</h3>
          </div>
          {wallet?.solana_pubkey ? (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" />Provisioned
            </Badge>
          ) : (
            <Button size="sm" onClick={provisionWallet} disabled={busy}>
              {busy ? "Creating…" : "Create wallet"}
            </Button>
          )}
        </div>
        {wallet?.solana_pubkey && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs">
              <span className="flex-1 truncate">{wallet.solana_pubkey}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(wallet.solana_pubkey);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Copy wallet address"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your SONA balance is locked while the token economy completes its launch phase. Mining, payroll, and staking all
              settle to this wallet.
            </p>
          </div>
        )}
      </Card>

      {/* Engagement weights */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">SONA economy — engagement weights</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Every verified action adds to your Qualified Engagement Score, which tops up your SONA alongside mining.
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
                  <div className="font-medium capitalize">{(e.action ?? e.action_type)?.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatRelative(e.created_at)} · {e.pool} pool
                  </div>
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
