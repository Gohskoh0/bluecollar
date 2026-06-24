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
import { isVideoMedia, resolvePostMedia, resolveProfileMedia, toStorageRef } from "@/lib/storage-media";

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
    const resolvedPosts = await Promise.all((postData as any[]).map(async (p) => ({
      ...(await resolvePostMedia(p)),
      author: await resolveProfileMedia(p.author),
      liked: likedSet.has(p.id),
    })));
    setPosts(resolvedPosts);
  }

  function pickMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) return toast.error("Choose an image or video");
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
      imageUrl = toStorageRef("post-media", path);
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
    }
    setPosts((prev) => prev.map((x) => x.id === p.id ? { ...x, liked: !x.liked, like_count: x.like_count + (x.liked ? -1 : 1) } : x));
  }

  async function repost(p: PostRow) {
    if (!user) return;
    const { error } = await supabase.from("reposts").insert({ post_id: p.id, user_id: user.id });
    if (error) {
      if (error.code === "23505") return toast.info("You already reposted this");
      return toast.error(error.message);
    }
    toast.success("Reposted to your network");
  }

  return (
    <div className="mx-auto grid w-full max-w-[1128px] gap-6 lg:grid-cols-[225px_minmax(0,555px)_300px]">
      {/* Left: profile card */}
      <aside className="hidden lg:block">
        <Card className="overflow-hidden">
          <div className="h-14 bg-gradient-to-br from-primary to-primary-hover" />
          <div className="-mt-8 flex flex-col items-center px-4 pb-4">
            <Avatar className="h-16 w-16 border-4 border-card">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">{profile ? initials(profile.full_name) : "?"}</AvatarFallback>
            </Avatar>
            <div className="mt-2 text-center">
              <div className="font-semibold text-sm">{profile?.full_name}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{profile?.headline ?? "Add a headline"}</div>
            </div>
          </div>
          <div className="border-t border-border px-4 py-3 text-xs">
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Followers</span><span className="font-semibold">{profile?.follower_count ?? 0}</span></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">QES</span><span className="font-semibold text-primary">{profile?.qes_score ?? 0}</span></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Reputation</span><span className="font-semibold">{profile?.reputation_score ?? 0}/1000</span></div>
          </div>
        </Card>
      </aside>

      {/* Center: composer + posts (LinkedIn-width column, max 555px) */}
      <div className="min-w-0 space-y-2">
        <Card className="p-3 sm:p-4">
          <div className="flex gap-2 sm:gap-3">
            <Avatar className="h-10 w-10 shrink-0 sm:h-12 sm:w-12">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">{profile ? initials(profile.full_name) : "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <Textarea value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Start a post…" className="min-h-[44px] resize-none rounded-full border border-border bg-transparent px-4 py-2.5 text-sm focus-visible:ring-1" />
              <input ref={mediaInputRef} type="file" accept="image/*,video/*" hidden onChange={pickMedia} />
              {mediaPreview && (
                <div className="relative mt-3 overflow-hidden rounded-lg border border-border bg-muted/40">
                  {mediaFile?.type.startsWith("video/") ? (
                    <video src={mediaPreview} className="max-h-[360px] w-full object-contain" controls />
                  ) : (
                    <img src={mediaPreview} alt="Selected media preview" className="max-h-[360px] w-full object-contain" />
                  )}
                  <Button type="button" variant="secondary" size="icon" className="absolute right-2 top-2 h-8 w-8" onClick={clearMedia} aria-label="Remove media">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                <Button type="button" variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => mediaInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" /> <span className="hidden xs:inline">Media</span>
                </Button>
                <Button onClick={publish} disabled={(!composer.trim() && !mediaFile) || posting} size="sm" className="gap-2 rounded-full px-4">
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {posting ? "Posting…" : "Post"}
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
          <Card key={p.id} className="overflow-hidden">
            <div className="flex items-start gap-2 px-3 pt-3 sm:px-4 sm:pt-4">
              <Avatar className="h-10 w-10 shrink-0 sm:h-12 sm:w-12">
                <AvatarImage src={p.author?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials(p.author?.full_name ?? "U")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{p.author?.full_name}</span>
                  {p.author?.verified_badge && <Badge variant="secondary" className="h-4 shrink-0 px-1 text-[10px]">Verified</Badge>}
                </div>
                <div className="truncate text-xs text-muted-foreground">{p.author?.headline ?? `@${p.author?.username}`}</div>
                <div className="text-xs text-muted-foreground">{formatRelative(p.created_at)}</div>
              </div>
            </div>
            {p.content && (
              <p className="whitespace-pre-wrap px-3 pt-2 text-sm leading-relaxed sm:px-4">{p.content}</p>
            )}
            {p.image_url && (
              <div className="mt-3 bg-muted">
                {isVideoMedia(p.image_url) ? (
                  <video src={p.image_url} className="block max-h-[510px] w-full object-contain" controls preload="metadata" />
                ) : (
                  <img src={p.image_url} alt="Post media" className="block max-h-[510px] w-full object-contain" loading="lazy" />
                )}
              </div>
            )}
            <div className="flex items-center justify-between px-3 pt-3 text-xs text-muted-foreground sm:px-4">
              <span>{p.like_count} likes</span>
              <span>{p.comment_count} comments</span>
            </div>
            <div className="mt-1 grid grid-cols-4 gap-0 border-t border-border px-1 py-1 sm:px-2">
              <Button variant="ghost" size="sm" onClick={() => toggleLike(p)} className={`gap-1.5 ${p.liked ? "text-primary" : "text-muted-foreground"}`}>
                <Heart className={`h-4 w-4 ${p.liked ? "fill-current" : ""}`} /> <span className="hidden sm:inline">Like</span>
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"><MessageCircle className="h-4 w-4" /> <span className="hidden sm:inline">Comment</span></Button>
              <Button variant="ghost" size="sm" onClick={() => repost(p)} className="gap-1.5 text-muted-foreground"><Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Repost</span></Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"><Send className="h-4 w-4" /> <span className="hidden sm:inline">Send</span></Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Right rail (desktop only) */}
      <aside className="hidden lg:block">
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">SONA Rewards</h3>
          <p className="text-xs text-muted-foreground">Earn SONA by posting, engaging, and building reputation. Rewards accumulate and unlock at mainnet launch.</p>
        </Card>
      </aside>
    </div>
  );
}
