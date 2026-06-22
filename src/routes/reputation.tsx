import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, ShieldCheck, Award } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { initials } from "@/lib/utils";

export const Route = createFileRoute("/reputation")({
  head: () => ({ meta: [{ title: "Reputation · BlueCollar" }, { name: "description", content: "Your BlueCollar Professional Reputation Score and the platform leaderboard." }] }),
  component: () => (<AppShell><RepPage/></AppShell>),
});

const FACTORS = [
  { name: "Profile completeness", weight: 10 },
  { name: "Work history accuracy", weight: 20 },
  { name: "Engagement quality", weight: 20 },
  { name: "Skill validation", weight: 25 },
  { name: "Employer endorsements", weight: 15 },
  { name: "Platform contribution", weight: 10 },
];

function RepPage() {
  const { profile } = useAuth();
  const [top, setTop] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("profiles_public" as "profiles").select("id,username,full_name,avatar_url,qes_score,reputation_score").order("qes_score", { ascending: false }).limit(20).then(({ data }) => setTop(data ?? []));
  }, []);

  const score = profile?.reputation_score ?? Math.min(1000, (profile?.profile_completeness ?? 0) * 5 + (profile?.qes_score ?? 0) / 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="h-6 w-6 text-primary" /> Professional Reputation</h1>
        <p className="text-sm text-muted-foreground">Your PRS reflects the quality and verified contribution of your activity.</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Your PRS</div>
            <div className="mt-1 text-5xl font-bold text-primary">{Math.round(score)} <span className="text-xl text-muted-foreground">/ 1000</span></div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {profile?.verified_badge && <Badge className="gap-1"><ShieldCheck className="h-3 w-3"/>Verified</Badge>}
            {profile?.kyc_verified && <Badge variant="secondary" className="gap-1"><Award className="h-3 w-3"/>KYC</Badge>}
          </div>
        </div>
        <Progress value={(score / 1000) * 100} className="mt-4" />
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 font-semibold">Reputation factors</h3>
        <div className="space-y-3">
          {FACTORS.map((f) => (
            <div key={f.name}>
              <div className="mb-1 flex justify-between text-sm"><span>{f.name}</span><span className="font-semibold">{f.weight}%</span></div>
              <Progress value={f.weight * 4} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 font-semibold">Top contributors (by QES)</h3>
        {top.length === 0 ? <p className="text-sm text-muted-foreground">Be the first to climb the leaderboard.</p> : (
          <div className="divide-y divide-border">
            {top.map((u, i) => (
              <div key={u.id} className="flex items-center gap-3 py-2">
                <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                <Avatar className="h-9 w-9"><AvatarImage src={u.avatar_url ?? undefined}/><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials(u.full_name)}</AvatarFallback></Avatar>
                <div className="flex-1">
                  <div className="text-sm font-medium">{u.full_name}</div>
                  <div className="text-xs text-muted-foreground">@{u.username}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-primary">{u.qes_score?.toLocaleString() ?? 0} QES</div>
                  <div className="text-xs text-muted-foreground">PRS {u.reputation_score ?? 0}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
