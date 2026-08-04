import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, MessagesSquare } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatRelative, initials } from "@/lib/utils";
import { resolveProfileMedia } from "@/lib/storage-media";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages · Sonari" }] }),
  component: () => (<AppShell><MessagesPage /></AppShell>),
});

type ProfileLite = { id: string; username: string; full_name: string; avatar_url: string | null };
type Msg = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null };

function MessagesPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ProfileLite[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (user) loadContacts(); }, [user?.id]);
  useEffect(() => { if (activeId) loadThread(activeId); }, [activeId]);

  async function loadContacts() {
    if (!user) return;
    const { data } = await supabase
      .from("connections")
      .select("requester_id,addressee_id,requester:profiles!connections_requester_id_fkey(id,username,full_name,avatar_url),addressee:profiles!connections_addressee_id_fkey(id,username,full_name,avatar_url)")
      .eq("status", "accepted");
    const others = (data ?? []).map((r: any) => r.requester_id === user.id ? r.addressee : r.requester);
    const resolved = await Promise.all(others.map((p: any) => resolveProfileMedia(p)));
    setContacts(resolved);
    if (!activeId && resolved.length) setActiveId(resolved[0].id);
  }

  async function loadThread(otherId: string) {
    if (!user) return;
    const { data } = await supabase
      .from("messages").select("*")
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`)
      .order("created_at", { ascending: true }).limit(200);
    setThread((data ?? []) as Msg[]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    // mark received as read
    await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("recipient_id", user.id).eq("sender_id", otherId).is("read_at", null);
  }

  async function send() {
    if (!user || !activeId || !draft.trim()) return;
    const body = draft.trim();
    setDraft("");
    const { error, data } = await supabase.from("messages").insert({ sender_id: user.id, recipient_id: activeId, body }).select().single();
    if (error) { toast.error(error.message); setDraft(body); return; }
    setThread((p) => [...p, data as Msg]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const active = useMemo(() => contacts.find((c) => c.id === activeId) ?? null, [contacts, activeId]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-3 flex items-center gap-2"><MessagesSquare className="h-5 w-5" /><h1 className="text-xl font-bold">Messages</h1></div>
      <Card className="grid h-[70vh] grid-cols-[260px_1fr] overflow-hidden md:grid-cols-[320px_1fr]">
        <aside className="overflow-y-auto border-r border-border">
          {contacts.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Connect with people to start messaging.</div>}
          {contacts.map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)} className={`flex w-full items-center gap-3 border-b border-border p-3 text-left hover:bg-muted/40 ${activeId === c.id ? "bg-muted/60" : ""}`}>
              <Avatar className="h-10 w-10"><AvatarImage src={c.avatar_url ?? undefined} /><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials(c.full_name)}</AvatarFallback></Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{c.full_name}</div>
                <div className="truncate text-xs text-muted-foreground">@{c.username}</div>
              </div>
            </button>
          ))}
        </aside>
        <section className="flex min-w-0 flex-col">
          {!active ? (
            <div className="m-auto text-sm text-muted-foreground">Select a conversation</div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-border p-3">
                <Avatar className="h-9 w-9"><AvatarImage src={active.avatar_url ?? undefined} /><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials(active.full_name)}</AvatarFallback></Avatar>
                <div><div className="text-sm font-semibold">{active.full_name}</div><div className="text-xs text-muted-foreground">@{active.username}</div></div>
              </header>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {thread.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <div className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{formatRelative(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
              <div className="flex items-end gap-2 border-t border-border p-3">
                <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message…" className="min-h-[44px] resize-none" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}} />
                <Button onClick={send} disabled={!draft.trim()} className="gap-1.5"><Send className="h-4 w-4" /> Send</Button>
              </div>
            </>
          )}
        </section>
      </Card>
    </div>
  );
}
