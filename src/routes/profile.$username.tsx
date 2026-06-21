import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, ShieldCheck, Pencil, Coins, Trophy, FileText, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/utils";
import { PhotoUploader } from "@/components/profile/AvatarUploader";
import { MonetizationTab } from "@/components/profile/MonetizationTab";
import { getFeatures, PLAN_LABEL } from "@/lib/feature-gates";
import { isVideoMedia, resolvePostMedia, resolveProfileMedia } from "@/lib/storage-media";

export const Route = createFileRoute("/profile/$username")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} · BlueCollar` }, { name: "description", content: `Profile of @${params.username} on BlueCollar.` }] }),
  component: () => (<AppShell><ProfilePage/></AppShell>),
});

function ProfilePage() {
  const { username } = useParams({ from: "/profile/$username" });
  const { user, refresh } = useAuth();
  const [p, setP] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [following, setFollowing] = useState(false);
  const [edit, setEdit] = useState(false);
  const [headline, setHeadline] = useState(""); const [bio, setBio] = useState(""); const [loc, setLoc] = useState(""); const [skills, setSkills] = useState("");

  useEffect(() => { load(); }, [username, user?.id]);

  async function load() {
    const { data } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
    if (!data) { setP(null); return; }
    const resolvedProfile = data ? await resolveProfileMedia(data) : null;
    setP(resolvedProfile);
    setHeadline(data.headline ?? ""); setBio(data.bio ?? ""); setLoc(data.location ?? ""); setSkills((data.skills ?? []).join(", "));
    const { data: ps } = await supabase.from("posts").select("*").eq("author_id", data.id).order("created_at", { ascending: false }).limit(20);
    setPosts(await Promise.all((ps ?? []).map((post) => resolvePostMedia(post))));
    if (user && user.id !== data.id) {
      const { data: f } = await supabase.from("follows").select("follower_id").eq("follower_id", user.id).eq("following_id", data.id).maybeSingle();
      setFollowing(!!f);
    }
  }

  async function toggleFollow() {
    if (!user || !p) return;
    if (following) await supabase.from("follows").delete().match({ follower_id: user.id, following_id: p.id });
    else await supabase.from("follows").insert({ follower_id: user.id, following_id: p.id });
    setFollowing(!following); load();
  }

  async function save() {
    if (!user) return;
    const skillArr = skills.split(",").map(s => s.trim()).filter(Boolean);
    const completeness = [headline, bio, loc, skillArr.length > 0].filter(Boolean).length * 20 + 20;
    const { error } = await supabase.from("profiles").update({ headline, bio, location: loc, skills: skillArr, profile_completeness: Math.min(100, completeness) }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated"); setEdit(false); refresh(); load();
  }

  if (!p) return <Card className="p-10 text-center text-muted-foreground">Profile not found.</Card>;
  const isOwn = user?.id === p.id;
  const features = getFeatures(p);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        {/* Cover */}
        <div className="relative h-44 bg-gradient-to-br from-primary via-primary-hover to-primary">
          {p.cover_url && <img src={p.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          {isOwn && (
            <div className="absolute right-3 top-3">
              <PhotoUploader userId={p.id} kind="cover" onUploaded={(url) => setP({ ...p, cover_url: url })} />
            </div>
          )}
        </div>
        <div className="px-6 pb-6">
          <div className="-mt-12 flex items-end justify-between">
            <div className="relative">
              <Avatar className="h-24 w-24 border-4 border-card">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">{initials(p.full_name)}</AvatarFallback>
              </Avatar>
              {isOwn && (
                <div className="absolute -bottom-1 -right-1">
                  <PhotoUploader userId={p.id} kind="avatar" onUploaded={(url) => setP({ ...p, avatar_url: url })} label="" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {isOwn ? (
                <Dialog open={edit} onOpenChange={setEdit}>
                  <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-2"><Pencil className="h-4 w-4"/>Edit profile</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Headline</Label><Input value={headline} onChange={(e)=>setHeadline(e.target.value)} placeholder="Senior Engineer at…" /></div>
                      <div><Label>Bio</Label><Textarea value={bio} onChange={(e)=>setBio(e.target.value)} rows={4} /></div>
                      <div><Label>Location</Label><Input value={loc} onChange={(e)=>setLoc(e.target.value)} /></div>
                      <div><Label>Skills (comma separated)</Label><Input value={skills} onChange={(e)=>setSkills(e.target.value)} placeholder="React, Product, SQL" /></div>
                      <Button onClick={save} className="w-full">Save</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button size="sm" onClick={toggleFollow} variant={following ? "outline" : "default"}>{following ? "Following" : "Follow"}</Button>
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{p.full_name}</h1>
              {(p.verified_badge || features.verifiedBadge) && <Badge className="gap-1"><ShieldCheck className="h-3 w-3"/>Verified</Badge>}
              <Badge variant="outline" className="capitalize">{p.user_type}</Badge>
              <Badge variant="secondary">{PLAN_LABEL[p.plan as keyof typeof PLAN_LABEL] ?? p.plan}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{p.headline ?? "—"}</p>
            {p.location && <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3"/>{p.location}</p>}
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span><strong>{p.follower_count}</strong> <span className="text-muted-foreground">followers</span></span>
              <span><strong>{p.following_count}</strong> <span className="text-muted-foreground">following</span></span>
              <span className="flex items-center gap-1"><Coins className="h-3.5 w-3.5 text-primary"/><strong>{p.qes_score?.toLocaleString() ?? 0}</strong> <span className="text-muted-foreground">QES</span></span>
            </div>
            {p.bio && <p className="mt-3 text-sm whitespace-pre-wrap">{p.bio}</p>}
            {p.skills && p.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.skills.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="posts">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="posts" className="gap-1.5"><FileText className="h-4 w-4"/>Posts</TabsTrigger>
          {isOwn && <TabsTrigger value="monetization" className="gap-1.5"><Coins className="h-4 w-4"/>Monetization</TabsTrigger>}
          <TabsTrigger value="reputation" className="gap-1.5"><Trophy className="h-4 w-4"/>Reputation</TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <Card className="p-4">
            {posts.length === 0 ? <p className="text-sm text-muted-foreground">No posts yet.</p> : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div key={post.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                    {post.image_url && (
                      <div className="mt-3 overflow-hidden rounded-lg border border-border">
                        {isVideoMedia(post.image_url) ? (
                          <video src={post.image_url} className="max-h-[360px] w-full object-contain" controls preload="metadata" />
                        ) : (
                          <img src={post.image_url} alt="Post media" className="max-h-[360px] w-full object-contain" loading="lazy" />
                        )}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground">{post.like_count} likes · {post.comment_count} comments</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {isOwn && (
          <TabsContent value="monetization">
            <MonetizationTab />
          </TabsContent>
        )}

        <TabsContent value="reputation">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Professional Reputation Score</div>
                <div className="mt-1 text-4xl font-bold text-primary">{p.reputation_score ?? 0} <span className="text-lg text-muted-foreground">/ 1000</span></div>
              </div>
              <Sparkles className="h-8 w-8 text-primary/50" />
            </div>
            <Progress value={((p.reputation_score ?? 0) / 1000) * 100} />
            <p className="mt-3 text-xs text-muted-foreground">
              Built from profile completeness, work history, engagement quality, skill validation, employer endorsements, and platform contribution.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
