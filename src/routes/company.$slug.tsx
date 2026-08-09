import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Coins,
  Users,
  Wallet,
  TrendingUp,
  Search,
  UserPlus,
  Trash2,
  Banknote,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolveProfileMedia } from "@/lib/storage-media";
import { formatRelative } from "@/lib/utils";

export const Route = createFileRoute("/company/$slug")({
  head: () => ({
    meta: [
      { title: "Company management · Sonari" },
      { name: "description", content: "Manage your Sonari company: employees, SONA payroll, treasury and company worth." },
      { property: "og:title", content: "Company management · Sonari" },
      { property: "og:description", content: "Manage employees, run SONA payroll and track your company worth on Sonari." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <CompanyManagePage />
    </AppShell>
  ),
});

interface Member {
  id: string;
  user_id: string;
  role: string;
  title: string | null;
  salary_sona: number;
  status: string;
  profile?: any;
}

function CompanyManagePage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const [company, setCompany] = useState<any>(null);
  const [worth, setWorth] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // add employee
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // dialogs
  const [payFor, setPayFor] = useState<Member | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [fundOpen, setFundOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) load();
  }, [user?.id, slug]);

  async function load() {
    setLoading(true);
    const { data: c } = await supabase.from("companies").select("*").eq("slug", slug).maybeSingle();
    setCompany(c);
    if (!c) return setLoading(false);

    const [{ data: w }, { data: ms }, { data: ps }, { data: myWallet }] = await Promise.all([
      supabase.rpc("company_worth" as any, { p_company_id: c.id }),
      supabase.from("company_members").select("*").eq("company_id", c.id).order("created_at"),
      supabase.from("company_payments").select("*").eq("company_id", c.id).order("created_at", { ascending: false }).limit(25),
      user ? supabase.from("sona_wallets").select("pending_balance").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null } as any),
    ]);

    setWorth(Number(w ?? 0));
    setWallet(myWallet);

    const rows = (ms ?? []) as Member[];
    const ids = Array.from(new Set([...rows.map((m) => m.user_id), ...(ps ?? []).map((p: any) => p.user_id)]));
    let byId: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, headline")
        .in("id", ids);
      for (const p of profs ?? []) byId[p.id] = await resolveProfileMedia(p as any);
    }
    setMembers(rows.map((m) => ({ ...m, profile: byId[m.user_id] })));
    setPayments((ps ?? []).map((p: any) => ({ ...p, profile: byId[p.user_id] })));
    setLoading(false);
  }

  const isAdmin =
    !!company &&
    !!user &&
    (company.owner_id === user.id || members.some((m) => m.user_id === user.id && ["owner", "admin"].includes(m.role) && m.status === "active"));

  async function search() {
    if (query.trim().length < 2) return;
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, headline")
      .or(`username.ilike.%${query.trim()}%,full_name.ilike.%${query.trim()}%`)
      .limit(8);
    const resolved = await Promise.all((data ?? []).map((p: any) => resolveProfileMedia(p)));
    setResults(resolved.filter((p: any) => !members.some((m) => m.user_id === p.id)));
    setSearching(false);
  }

  async function addEmployee(profileId: string) {
    if (!company) return;
    const { error } = await supabase
      .from("company_members")
      .insert({ company_id: company.id, user_id: profileId, role: "employee", status: "active" } as any);
    if (error) return toast.error(error.message);
    toast.success("Employee added to your team");
    setResults((r) => r.filter((p) => p.id !== profileId));
    load();
  }

  async function updateMember(m: Member, patch: Partial<Member>) {
    const { error } = await supabase.from("company_members").update(patch as any).eq("id", m.id);
    if (error) return toast.error(error.message);
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
  }

  async function removeMember(m: Member) {
    const { error } = await supabase.from("company_members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Employee removed");
    load();
  }

  async function fundTreasury() {
    const amt = Math.floor(Number(fundAmount));
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    const { error } = await supabase.rpc("fund_company_treasury" as any, { p_company_id: company.id, p_amount: amt });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Funded treasury with ${amt.toLocaleString()} SONA`);
    setFundOpen(false);
    setFundAmount("");
    load();
  }

  async function pay() {
    if (!payFor) return;
    const amt = Math.floor(Number(payAmount));
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    const { error } = await supabase.rpc("pay_employee_sona" as any, {
      p_company_id: company.id,
      p_member_id: payFor.id,
      p_amount: amt,
      p_note: payNote || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Paid ${amt.toLocaleString()} SONA to ${payFor.profile?.full_name ?? "employee"}`);
    setPayFor(null);
    setPayAmount("");
    setPayNote("");
    load();
  }

  if (loading) return <div className="py-16 text-center text-muted-foreground">Loading company…</div>;
  if (!company)
    return (
      <Card className="p-10 text-center">
        <h1 className="text-xl font-semibold">Company not found</h1>
        <Link to="/companies" className="mt-3 inline-block">
          <Button variant="outline">Back to companies</Button>
        </Link>
      </Card>
    );

  if (!isAdmin)
    return (
      <Card className="p-10 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 text-xl font-semibold">Management is restricted</h1>
        <p className="mt-1 text-sm text-muted-foreground">Only {company.name}'s owner and admins can manage the team.</p>
        <Link to="/companies" className="mt-4 inline-block">
          <Button variant="outline">Back to companies</Button>
        </Link>
      </Card>
    );

  const payrollTotal = members.reduce((s, m) => s + Number(m.salary_sona || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/companies">
          <Button variant="ghost" size="icon" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <p className="text-sm text-muted-foreground">{company.tagline || company.industry || "Company management"}</p>
        </div>
        <Button onClick={() => setFundOpen(true)} className="gap-2">
          <Wallet className="h-4 w-4" /> Fund treasury
        </Button>
      </div>

      {/* Worth cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Company worth
          </div>
          <div className="mt-2 text-2xl font-bold">{worth.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">SONA</span></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Coins className="h-3.5 w-3.5" /> Treasury
          </div>
          <div className="mt-2 text-2xl font-bold">{Number(company.sona_treasury ?? 0).toLocaleString()}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Employees
          </div>
          <div className="mt-2 text-2xl font-bold">{members.filter((m) => m.status === "active").length}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Banknote className="h-3.5 w-3.5" /> Monthly payroll
          </div>
          <div className="mt-2 text-2xl font-bold">{payrollTotal.toLocaleString()}</div>
        </Card>
      </div>

      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="add">Add employee</TabsTrigger>
          <TabsTrigger value="payroll">Payroll history</TabsTrigger>
        </TabsList>

        {/* Team */}
        <TabsContent value="team" className="mt-4 space-y-3">
          {members.length === 0 && (
            <Card className="p-10 text-center text-muted-foreground">No employees yet. Add teammates from the Sonari community.</Card>
          )}
          {members.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={m.profile?.avatar_url ?? undefined} alt={m.profile?.full_name ?? "Employee"} />
                  <AvatarFallback>{(m.profile?.full_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-[9rem] flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{m.profile?.full_name ?? "Sonari user"}</span>
                    <Badge variant="outline" className="capitalize">{m.role}</Badge>
                    {m.status !== "active" && <Badge variant="secondary" className="capitalize">{m.status}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">@{m.profile?.username ?? "user"} · {m.title || "No title set"}</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label className="text-xs">Title</Label>
                    <Input
                      className="h-9 w-40"
                      defaultValue={m.title ?? ""}
                      onBlur={(e) => e.target.value !== (m.title ?? "") && updateMember(m, { title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Salary (SONA)</Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-9 w-32"
                      defaultValue={m.salary_sona}
                      onBlur={(e) =>
                        Number(e.target.value) !== m.salary_sona && updateMember(m, { salary_sona: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Role</Label>
                    <Select value={m.role} onValueChange={(v) => updateMember(m, { role: v })}>
                      <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={m.status} onValueChange={(v) => updateMember(m, { status: v })}>
                      <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    className="h-9 gap-2"
                    onClick={() => {
                      setPayFor(m);
                      setPayAmount(String(m.salary_sona || ""));
                    }}
                  >
                    <Coins className="h-4 w-4" /> Pay
                  </Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" aria-label="Remove employee" onClick={() => removeMember(m)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Add employee */}
        <TabsContent value="add" className="mt-4">
          <Card className="p-5">
            <h3 className="font-semibold">Add an employee</h3>
            <p className="mt-1 text-sm text-muted-foreground">Search registered Sonari members by name or username.</p>
            <div className="mt-3 flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="Jane Doe or janedoe"
              />
              <Button onClick={search} disabled={searching} className="gap-2">
                <Search className="h-4 w-4" /> {searching ? "Searching…" : "Search"}
              </Button>
            </div>
            <div className="mt-4 divide-y divide-border">
              {results.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={p.avatar_url ?? undefined} alt={p.full_name} />
                    <AvatarFallback>{(p.full_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">@{p.username} · {p.headline || "Sonari member"}</div>
                  </div>
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => addEmployee(p.id)}>
                    <UserPlus className="h-4 w-4" /> Add
                  </Button>
                </div>
              ))}
              {!searching && query.length >= 2 && results.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">No matching members found.</p>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Payroll */}
        <TabsContent value="payroll" className="mt-4">
          <Card className="p-5">
            <h3 className="font-semibold">SONA payroll history</h3>
            {payments.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <div className="mt-2 divide-y divide-border">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <div className="font-medium">{p.profile?.full_name ?? "Employee"}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelative(p.created_at)}
                        {p.note ? ` · ${p.note}` : ""}
                      </div>
                    </div>
                    <div className="font-semibold text-primary">{Number(p.amount).toLocaleString()} SONA</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Fund dialog */}
      <Dialog open={fundOpen} onOpenChange={setFundOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fund {company.name} treasury</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted p-3 text-sm">
              Your balance: <span className="font-semibold">{Number(wallet?.pending_balance ?? 0).toLocaleString()} SONA</span>
            </div>
            <div>
              <Label>Amount (SONA)</Label>
              <Input type="number" min={1} value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">Treasury SONA is used to pay salaries and counts toward company worth.</p>
            <Button className="w-full" onClick={fundTreasury} disabled={busy}>
              {busy ? "Transferring…" : "Fund treasury"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay dialog */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pay {payFor?.profile?.full_name ?? "employee"} in SONA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted p-3 text-sm">
              Treasury: <span className="font-semibold">{Number(company.sona_treasury ?? 0).toLocaleString()} SONA</span>
            </div>
            <div>
              <Label>Amount (SONA)</Label>
              <Input type="number" min={1} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="March salary" />
            </div>
            <Button className="w-full" onClick={pay} disabled={busy}>
              {busy ? "Paying…" : `Pay ${payAmount || 0} SONA`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
