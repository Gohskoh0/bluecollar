import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { resolveProfileMedia } from "@/lib/storage-media";

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  user_type: "professional" | "recruiter" | "company";
  plan: "free" | "pro" | "expert" | "recruiter_pro" | "recruiter_expert";
  kyc_verified: boolean;
  verified_badge: boolean;
  reputation_score: number;
  qes_score: number;
  follower_count: number;
  following_count: number;
  profile_completeness: number;
  skills: string[] | null;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // defer to avoid deadlock
        setTimeout(() => loadProfile(s.user!.id), 0);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data) setProfile(await resolveProfileMedia(data as Profile));
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refresh() {
    if (user) await loadProfile(user.id);
  }

  return { session, user, profile, loading, signOut, refresh };
}
