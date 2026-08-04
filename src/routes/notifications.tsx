import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Heart, MessageCircle, UserPlus, Share2, Star, Users, Mail, CheckCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatRelative, initials } from "@/lib/utils";
import { resolveProfileMedia } from "@/lib/storage-media";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Sonari" }] }),
  component: () => (<AppShell><NotificationsPage /></AppShell>),
});

type NotifRow = {
  id: string; kind: string; entity_type: string | null; entity_id: string | null;
  payload: any; read_at: string | null; created_at: string;
  actor: { id: string; username: string; full_name: string; avatar_url: string | null } | null;
};

const ICONS: Record<string, any> = {
  like: Heart, comment: MessageCircle, follow: UserPlus, repost: Share2,
  endorsement: Star, message: Mail, connection_request: Users, connection_accepted: Users,
};

function label(n: NotifRow) {
  const name = n.actor?.full_name ?? "Someone";
  switch (n.kind) {
    case "like": return `${name} liked your post`;
    case "comment": return `${name} commented on your post`;
    case "follow": return `${name} started following you`;
    case "repost": return `${name} reposted your post`;
    case "endorsement": return `${name} endorsed you for ${n.payload?.skill ?? "a skill"}`;
    case "message": return `${name} sent you a message`;
    case "connection_request": return `${name} wants to connect`;
    case "connection_accepted": return `${name} accepted your connection`;
    default: return `${name} interacted with you`;
  }
}

function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotifRow[]>([]);

  useEffect(() => { if (user) load(); }, [user?.id]);

  async function load() {
    const { data } = await supabase
      .from("notifications")
      .select("id,kind,entity_type,entity_id,payload,read_at,created_at,actor:profiles!notifications_actor_id_fkey(id,username,full_name,avatar_url)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!data) return;
    const resolved = await Promise.all((data as any[]).map(async (n) => ({
      ...n,
      actor: n.actor ? await resolveProfileMedia(n.actor) : null,
    })));
    setItems(resolved as NotifRow[]);
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("user_id", user.id);
    load();
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold"><Bell className="h-5 w-5" /> Notifications</h1>
        <Button variant="ghost" size="sm" onClick={markAllRead} className="gap-1.5"><CheckCheck className="h-4 w-4" /> Mark all read</Button>
      </div>
      <Card className="divide-y divide-border">
        {items.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">No notifications yet.</div>}
        {items.map((n) => {
          const Icon = ICONS[n.kind] ?? Bell;
          const unread = !n.read_at;
          return (
            <div key={n.id} className={`flex items-start gap-3 p-4 ${unread ? "bg-primary/5" : ""}`}>
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={n.actor?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials(n.actor?.full_name ?? "?")}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-1 -right-1 rounded-full bg-card p-1 ring-1 ring-border"><Icon className="h-3 w-3 text-primary" /></span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{label(n)}</p>
                <p className="text-xs text-muted-foreground">{formatRelative(n.created_at)}</p>
              </div>
              {n.actor && (
                <Link to="/profile/$username" params={{ username: n.actor.username }} className="text-xs font-medium text-primary hover:underline">
                  View
                </Link>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
