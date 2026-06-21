import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Heart, MessageCircle, Share2, Send, ImagePlus, X, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth, type Profile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ACTION_WEIGHTS, formatRelative, initials } from "@/lib/utils";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: "Feed · BlueCollar" }, { name: "description", content: "Your professional feed on BlueCollar." }] }),
  component: () => (<AppShell><FeedPage /></AppShell>),
});

interface PostRow {
  id: string;
  content: string;
  image_url: string | null;
  like_count: number;
  comment_count: number;
  share_count: number;
  created_at: string;
  author: Profile;
  liked?: boolean;
}

function FeedPage() {
  const { profile, user } = useAuth();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [composer, setComposer] = useState("");
  const [posting, setPosting] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadFeed(); }, [user?.id]);

  async function loadFeed() {
    const { data: postData } = await supabase
      .from("posts")
      .select("*, author:profiles!posts_author_id_fkey(*)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!postData) return;
    let likedSet = new Set<string>();
    if (user) {
      const { data: likes } = await supabase.from("likes").select("post_id").eq("user_id", user.id);
      likedSet = new Set((likes ?? []).map((l) => l.post_id));
    }
    setPosts((postData as any[]).map((p) => ({ ...p, liked: likedSet.has(p.id) })));
  }

  function pickMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast.error("Max 10MB");
    setMediaFile(f);
    setMediaPreview(URL.createObjectURL(f));
  }

  function clearMedia() {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  }

  async function publish() {
    if ((!composer.trim() && !mediaFile) || !user) return;
    setPosting(true);
    let imageUrl: string | null = null;
    if (mediaFile) {
      const ext = mediaFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("post-media").upload(path, mediaFile, { contentType: mediaFile.type, upsert: false });
      if (upErr) { setPosting(false); return toast.error(upErr.message); }
      const { data: signed, error: sErr } = await supabase.storage.from("post-media").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed) { setPosting(false); return toast.error(sErr?.message ?? "Sign failed"); }
      imageUrl = signed.signedUrl;
    }
    const { error } = await supabase.from("posts").insert({ author_id: user.id, content: composer.trim(), image_url: imageUrl });
    setPosting(false);
    if (error) return toast.error(error.message);
    setComposer("");
    clearMedia();
    toast.success("Post published");
    loadFeed();
  }

  async function toggleLike(p: PostRow) {
    if (!user) return;
    if (p.liked) {
      await supabase.from("likes").delete().match({ post_id: p.id, user_id: user.id });
    } else {
      await supabase.from("likes").insert({ post_id: p.id, user_id: user.id });
      await supabase.from("reward_events").insert({ user_id: user.id, action: "like", weight: ACTION_WEIGHTS.like.weight, pool: ACTION_WEIGHTS.like.pool });
    }
    setPosts((prev) => prev.map((x) => x.id === p.id ? { ...x, liked: !x.liked, like_count: x.like_count + (x.liked ? -1 : 1) } : x));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Left: profile card */}
      <aside className="hidden lg:block">
        <Card className="overflow-hidden">
          <div className="h-16 bg-gradient-to-br from-primary to-primary-hover" />
          <div className="-mt-8 flex flex-col items-center px-4 pb-4">
            <Avatar className="h-16 w-16 border-4 border-card">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">{profile ? initials(profile.full_name) : "?"}</AvatarFallback>
            </Avatar>
            <div className="mt-2 text-center">
              <div className="font-semibold">{profile?.full_name}</div>
              <div className="text-xs text-muted-foreground">{profile?.headline ?? "Add a headline"}</div>
            </div>
          </div>
          <div className="border-t border-border px-4 py-3 text-xs">
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Followers</span><span className="font-semibold">{profile?.follower_count ?? 0}</span></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">QES</span><span className="font-semibold text-primary">{profile?.qes_score ?? 0}</span></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Reputation</span><span className="font-semibold">{profile?.reputation_score ?? 0}/1000</span></div>
          </div>
        </Card>
      </aside>

      {/* Center: composer + posts */}
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">{profile ? initials(profile.full_name) : "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Share an insight, experience, or update…" className="min-h-[80px] resize-none border-0 bg-muted/40 focus-visible:ring-1" />
              <div className="mt-2 flex items-center justify-between">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground"><ImagePlus className="h-4 w-4" /> Media</Button>
                <Button onClick={publish} disabled={!composer.trim() || posting} size="sm" className="gap-2">
                  <Send className="h-4 w-4" /> {posting ? "Posting…" : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {posts.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground">
            <p>No posts yet. Be the first to share something with the community.</p>
          </Card>
        )}

        {posts.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={p.author?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials(p.author?.full_name ?? "U")}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{p.author?.full_name}</span>
                  {p.author?.verified_badge && <Badge variant="secondary" className="h-4 px-1 text-[10px]">Verified</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{p.author?.headline ?? `@${p.author?.username}`} · {formatRelative(p.created_at)}</div>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{p.content}</p>
            {p.image_url && (
              <div className="mt-3 overflow-hidden rounded-lg border border-border">
                <img src={p.image_url} alt="" className="max-h-[480px] w-full object-cover" loading="lazy" />
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-sm">
              <div className="text-xs text-muted-foreground">{p.like_count} likes · {p.comment_count} comments</div>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-1">
              <Button variant="ghost" size="sm" onClick={() => toggleLike(p)} className={p.liked ? "text-primary" : "text-muted-foreground"}>
                <Heart className={`mr-2 h-4 w-4 ${p.liked ? "fill-current" : ""}`} /> Like
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground"><MessageCircle className="mr-2 h-4 w-4" /> Comment</Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
