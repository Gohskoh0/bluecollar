import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, ShieldCheck, Award, Sparkles, TrendingUp, Users, Briefcase, Crown, Medal } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { initials } from "@/lib/utils";

export const Route = createFileRoute("/reputation")({
  head: () => ({ meta: [{ title: "Reputation · BlueCollar" }, { name: "description", content: "Your Professional Reputation Score and the global leaderboard." }] }),
  component: () => (<AppShell><RepPage/></AppShell>),
});

const PILLARS = [
  { key: "content", name: "Content & Engagement", weight: 30, icon: Sparkles, color: "from-sky-500 to-cyan-400", desc: "Quality posts, comments, and reactions you create." },
  { key: "hiring", name: "Hiring & Work", weight: 35, icon: Briefcase, color: "from-violet-500 to-fuchsia-400", desc: "Applications, hires, completed contracts, endorsements." },
  { key: "growth", name: "Growth & Trust", weight: 35, icon: TrendingUp, color: "from-emerald-500 to-teal-400", desc: "Verification, follower growth, company contributions." },
];

function Ring({ value, size = 168 }: { value: number; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke="hsl(var(--primary))" strokeWidth={stroke} fill="none"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
    </svg>
  );
}

function RepPage() {
  const { profile } = useAuth();
  const [top, setTop] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("profiles_public" as "profiles").select("id,username,full_name,avatar_url,qes_score,reputation_score").order("qes_score", { ascending: false }).limit(20).then(({ data }) => setTop(data ?? []));
  }, []);

  const score = Math.round(profile?.reputation_score ?? Math.min(1000, (profile?.profile_completeness ?? 0) * 5 + (profile?.qes_score ?? 0) / 10));
  const pct = (score / 1000) * 100;
  const percentile = Math.min(99, Math.max(1, Math.round(pct)));
  const tier = score >= 800 ? "Elite" : score >= 600 ? "Pro" : score >= 400 ? "Rising" : score >= 200 ? "Builder" : "Newcomer";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <Trophy className="h-7 w-7 text-primary" /> Professional Reputation
          </h1>
          <p className="text-sm text-muted-foreground">Your verified standing across content, hiring, and growth.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile?.verified_badge && <Badge className="gap-1"><ShieldCheck className="h-3 w-3"/>Verified</Badge>}
          {profile?.kyc_verified && <Badge variant="secondary" className="gap-1"><Award className="h-3 w-3"/>KYC</Badge>}
        </div>
      </div>

      {/* Hero score card */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/95 via-primary to-primary-hover p-6 text-primary-foreground shadow-lg sm:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="relative grid place-items-center">
            <Ring value={pct} />
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="text-4xl font-black tabular-nums">{score}</div>
                <div className="text-[10px] uppercase tracking-widest opacity-80">of 1000</div>
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <Badge variant="secondary" className="bg-white/15 text-primary-foreground hover:bg-white/20">{tier} tier</Badge>
            <div className="mt-2 text-xl font-semibold sm:text-2xl">You're ahead of {percentile}% of professionals</div>
            <p className="mt-1 text-sm opacity-90">Keep posting quality content, finishing contracts, and growing your verified network to climb tiers.</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <Stat label="QES" value={profile?.qes_score ?? 0} />
              <Stat label="Followers" value={profile?.follower_count ?? 0} />
              <Stat label="Complete" value={`${profile?.profile_completeness ?? 0}%`} />
            </div>
          </div>
        </div>
      </Card>

      {/* Pillars */}
      <div className="grid gap-4 md:grid-cols-3">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          const points = Math.round((profile?.qes_score ?? 0) * (p.weight / 100));
          return (
            <Card key={p.key} className="overflow-hidden">
              <div className={`h-1 w-full bg-gradient-to-r ${p.color}`} />
              <div className="space-y-3 p-5">
                <div className="flex items-start justify-between">
                  <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br ${p.color} text-white shadow-sm`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-xs">{p.weight}%</Badge>
                </div>
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.desc}</p>
                </div>
                <div>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-muted-foreground">Your points</span>
                    <span className="font-semibold tabular-nums">{points}</span>
                  </div>
                  <Progress value={Math.min(100, points / 5)} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Leaderboard */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold">Global leaderboard</h3>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Top {top.length || 20}
          </div>
        </div>
        {top.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Be the first to climb the leaderboard.</div>
        ) : (
          <div className="divide-y divide-border">
            {top.map((u, i) => {
              const rank = i + 1;
              const medal = rank === 1 ? "bg-amber-500/15 text-amber-600 border-amber-500/30" : rank === 2 ? "bg-slate-400/15 text-slate-500 border-slate-400/30" : rank === 3 ? "bg-orange-500/15 text-orange-600 border-orange-500/30" : "bg-muted text-muted-foreground border-border";
              return (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                  <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold tabular-nums ${medal}`}>
                    {rank <= 3 ? <Medal className="h-3.5 w-3.5" /> : rank}
                  </div>
                  <Avatar className="h-10 w-10 shrink-0"><AvatarImage src={u.avatar_url ?? undefined}/><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials(u.full_name)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{u.full_name}</div>
                    <div className="truncate text-xs text-muted-foreground">@{u.username}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-primary tabular-nums">{u.qes_score?.toLocaleString() ?? 0}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">QES · PRS {u.reputation_score ?? 0}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/10 px-2 py-2">
      <div className="text-base font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
    </div>
  );
}
