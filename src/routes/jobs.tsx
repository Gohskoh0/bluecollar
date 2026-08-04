import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Briefcase, MapPin, Plus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ACTION_WEIGHTS, formatRelative } from "@/lib/utils";

export const Route = createFileRoute("/jobs")({
  head: () => ({ meta: [{ title: "Jobs · Sonari" }, { name: "description", content: "Browse and post jobs on the Sonari marketplace." }] }),
  component: () => (<AppShell><JobsPage /></AppShell>),
});

function JobsPage() {
  const { user, profile } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  // form
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [loc, setLoc] = useState("");
  const [jt, setJt] = useState<"full_time"|"part_time"|"contract"|"internship"|"remote">("full_time");
  const [salMin, setSalMin] = useState(""); const [salMax, setSalMax] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("jobs")
      .select("*, company:companies(*), poster:profiles!jobs_posted_by_fkey(full_name, username, avatar_url)")
      .eq("is_open", true).order("featured", { ascending: false }).order("created_at", { ascending: false }).limit(50);
    setJobs(data ?? []);
  }

  async function createJob(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("jobs").insert({
      posted_by: user.id, title, description: desc, location: loc, job_type: jt,
      salary_min: salMin ? Number(salMin) : null, salary_max: salMax ? Number(salMax) : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Job posted");
    setOpen(false); setTitle(""); setDesc(""); setLoc(""); setSalMin(""); setSalMax("");
    load();
  }

  async function apply(jobId: string) {
    if (!user) return;
    const { error } = await supabase.from("applications").insert({ job_id: jobId, applicant_id: user.id });
    if (error) return toast.error(error.message.includes("duplicate") ? "Already applied" : error.message);
    // reward event auto-created server-side by trigger
    toast.success("Application submitted");
    load();
  }

  const filtered = jobs.filter(j => !query || j.title.toLowerCase().includes(query.toLowerCase()) || j.location?.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Job Marketplace</h1>
          <p className="text-sm text-muted-foreground">Verified roles from recruiters and companies on Sonari.</p>
        </div>
        {(profile?.user_type === "recruiter" || profile?.user_type === "company") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4"/> Post a job</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Post a new job</DialogTitle></DialogHeader>
              <form onSubmit={createJob} className="space-y-3">
                <div><Label>Title</Label><Input value={title} onChange={(e)=>setTitle(e.target.value)} required /></div>
                <div><Label>Description</Label><Textarea value={desc} onChange={(e)=>setDesc(e.target.value)} required rows={5} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Location</Label><Input value={loc} onChange={(e)=>setLoc(e.target.value)} placeholder="Remote, NYC…" /></div>
                  <div><Label>Type</Label>
                    <Select value={jt} onValueChange={(v)=>setJt(v as any)}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full-time</SelectItem>
                        <SelectItem value="part_time">Part-time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="internship">Internship</SelectItem>
                        <SelectItem value="remote">Remote</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Salary min (USD)</Label><Input type="number" value={salMin} onChange={(e)=>setSalMin(e.target.value)} /></div>
                  <div><Label>Salary max (USD)</Label><Input type="number" value={salMax} onChange={(e)=>setSalMax(e.target.value)} /></div>
                </div>
                <Button type="submit" className="w-full">Publish job</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search jobs…" />

      <div className="grid gap-3">
        {filtered.length === 0 && <Card className="p-10 text-center text-muted-foreground">No open jobs match your search.</Card>}
        {filtered.map((j) => (
          <Card key={j.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{j.title}</h3>
                    {j.featured && <Badge className="gap-1"><Sparkles className="h-3 w-3"/>Featured</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {j.company?.name ?? j.poster?.full_name}
                    {j.location && <> · <MapPin className="inline h-3 w-3" /> {j.location}</>}
                    {" · "}{j.job_type.replace("_"," ")}
                  </div>
                  {(j.salary_min || j.salary_max) && (
                    <div className="mt-1 text-xs font-medium text-success">
                      ${j.salary_min?.toLocaleString() ?? "—"} – ${j.salary_max?.toLocaleString() ?? "—"} {j.salary_currency}
                    </div>
                  )}
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{j.description}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs text-muted-foreground">{formatRelative(j.created_at)}</span>
                {j.posted_by !== user?.id && <Button size="sm" onClick={() => apply(j.id)}>Apply</Button>}
                <span className="text-xs text-muted-foreground">{j.application_count} applicants</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
