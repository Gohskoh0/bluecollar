import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, UserPlus, UserCheck, UserX, Check, X as XIcon } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { initials } from "@/lib/utils";
import { resolveProfileMedia } from "@/lib/storage-media";

export const Route = createFileRoute("/network")({
  head: () => ({ meta: [{ title: "My Network · BlueCollar" }] }),
  component: () => (<AppShell><NetworkPage /></AppShell>),
});

type ProfileLite = { id: string; username: string; full_name: string; headline: string | null; avatar_url: string | null };
type ConnRow = { id: string; requester_id: string; addressee_id: string; status: string; requester: ProfileLite; addressee: ProfileLite };

function NetworkPage() {
  const { user } = useAuth();
  const [accepted, setAccepted] = useState<ConnRow[]>([]);
  const [incoming, setIncoming] = useState<ConnRow[]>([]);
  const [outgoing, setOutgoing] = useState<ConnRow[]>([]);
  const [suggestions, setSuggestions] = useState<ProfileLite[]>([]);

  useEffect(() => { if (user) loadAll(); }, [user?.id]);

  async function loadAll() {
    if (!user) return;
    const { data } = await supabase
      .from("connections")
      .select("id,requester_id,addressee_id,status,requester:profiles!connections_requester_id_fkey(id,username,full_name,headline,avatar_url),addressee:profiles!connections_addressee_id_fkey(id,username,full_name,headline,avatar_url)")
      .order("updated_at", { ascending: false });
    const rows = (data ?? []) as any[];
    const resolved: ConnRow[] = await Promise.all(rows.map(async (r) => ({
      ...r,
      requester: await resolveProfileMedia(r.requester),
      addressee: await resolveProfileMedia(r.addressee),
    })));
    setAccepted(resolved.filter((r) => r.status === "accepted"));
    setIncoming(resolved.filter((r) => r.status === "pending" && r.addressee_id === user.id));
    setOutgoing(resolved.filter((r) => r.status === "pending" && r.requester_id === user.id));

    // suggestions: latest profiles excluding self + connected
    const excluded = new Set<string>([user.id, ...resolved.flatMap((r) => [r.requester_id, r.addressee_id])]);
    const { data: profs } = await supabase
      .from("profiles").select("id,username,full_name,headline,avatar_url")
      .order("created_at", { ascending: false }).limit(20);
    const filt = (profs ?? []).filter((p: any) => !excluded.has(p.id)).slice(0, 8);
    setSuggestions(await Promise.all(filt.map((p: any) => resolveProfileMedia(p))));
  }

  async function send(addressee_id: string) {
    if (!user) return;
    const { error } = await supabase.from("connections").insert({ requester_id: user.id, addressee_id });
    if (error) return toast.error(error.message);
    toast.success("Connection request sent");
    loadAll();
  }
  async function respond(id: string, status: "accepted" | "declined") {
    const { error } = await supabase.from("connections").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    loadAll();
  }
  async function remove(id: string) {
    await supabase.from("connections").delete().eq("id", id);
    loadAll();
  }

  function PersonCard({ p, action }: { p: ProfileLite; action: React.ReactNode }) {
    return (
      <Card className="flex items-center gap-3 p-3">
        <Link to="/profile/$username" params={{ username: p.username }}>
          <Avatar className="h-12 w-12">
            <AvatarImage src={p.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials(p.full_name)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <Link to="/profile/$username" params={{ username: p.username }} className="block truncate font-semibold text-sm hover:underline">{p.full_name}</Link>
          <div className="truncate text-xs text-muted-foreground">{p.headline ?? `@${p.username}`}</div>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </Card>
    );
  }

  const otherSide = (r: ConnRow) => r.requester_id === user?.id ? r.addressee : r.requester;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="flex items-center gap-2"><Users className="h-5 w-5" /><h1 className="text-xl font-bold">My Network</h1></div>
      <Tabs defaultValue="connections">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connections">Connections ({accepted.length})</TabsTrigger>
          <TabsTrigger value="invitations">Invitations ({incoming.length})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({outgoing.length})</TabsTrigger>
          <TabsTrigger value="grow">Grow</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-2 pt-3">
          {accepted.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No connections yet — try the Grow tab.</Card>}
          {accepted.map((r) => {
            const p = otherSide(r);
            return <PersonCard key={r.id} p={p} action={
              <Button variant="outline" size="sm" onClick={() => remove(r.id)} className="gap-1.5"><UserX className="h-4 w-4" /> Remove</Button>
            } />;
          })}
        </TabsContent>

        <TabsContent value="invitations" className="space-y-2 pt-3">
          {incoming.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No pending invitations.</Card>}
          {incoming.map((r) => (
            <PersonCard key={r.id} p={r.requester} action={
              <>
                <Button size="sm" onClick={() => respond(r.id, "accepted")} className="gap-1.5"><Check className="h-4 w-4" /> Accept</Button>
                <Button size="sm" variant="ghost" onClick={() => respond(r.id, "declined")} className="gap-1.5"><XIcon className="h-4 w-4" /> Ignore</Button>
              </>
            } />
          ))}
        </TabsContent>

        <TabsContent value="sent" className="space-y-2 pt-3">
          {outgoing.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No outgoing requests.</Card>}
          {outgoing.map((r) => (
            <PersonCard key={r.id} p={r.addressee} action={
              <Button variant="outline" size="sm" onClick={() => remove(r.id)} className="gap-1.5"><UserX className="h-4 w-4" /> Withdraw</Button>
            } />
          ))}
        </TabsContent>

        <TabsContent value="grow" className="space-y-2 pt-3">
          {suggestions.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No suggestions right now.</Card>}
          {suggestions.map((p) => (
            <PersonCard key={p.id} p={p} action={
              <Button size="sm" onClick={() => send(p.id)} className="gap-1.5"><UserPlus className="h-4 w-4" /> Connect</Button>
            } />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
