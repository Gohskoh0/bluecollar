import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import logo from "@/assets/bluecollar-logo.png";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

function getAuthRedirectUrl() {
  return `${window.location.origin}/feed`;
}

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in · BlueCollar" },
      { name: "description", content: "Sign in or create an account to join BlueCollar — the professional economy network." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode } = Route.useSearch();
  const [tab, setTab] = useState<"signin" | "signup">(mode === "signup" ? "signup" : "signin");
  const [loading, setLoading] = useState(false);

  // signup state
  const [fullName, setFullName] = useState("");
  const [userType, setUserType] = useState<"professional" | "recruiter" | "company">("professional");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/feed" });
    });
  }, [navigate]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
        data: { full_name: fullName, user_type: userType },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to verify your BlueCollar account.");
    setTab("signin");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        return toast.error("Please verify your email first.", {
          action: {
            label: "Resend",
            onClick: async () => {
              const { error: rErr } = await supabase.auth.resend({
                type: "signup",
                email,
                options: { emailRedirectTo: getAuthRedirectUrl() },
              });
              if (rErr) toast.error(rErr.message);
              else toast.success("Verification email sent.");
            },
          },
        });
      }
      if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
        return toast.error("Incorrect email or password.");
      }
      return toast.error(error.message);
    }
    navigate({ to: "/feed" });
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/feed` });
    if (result.error) {
      setLoading(false);
      return toast.error(result.error.message || "Google sign-in failed");
    }
    if (result.redirected) return;
    navigate({ to: "/feed" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-accent via-background to-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img src={logo} alt="BlueCollar" className="mx-auto h-12 w-12" width={48} height={48} />
          <h1 className="mt-3 text-2xl font-bold">Welcome to BlueCollar</h1>
          <p className="mt-1 text-sm text-muted-foreground">The Professional Economy Network</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-elevated">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <div className="mt-5">
              <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
                Continue with Google
              </Button>
              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
              </div>
            </div>

            <TabsContent value="signin" className="mt-0">
                <div>
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="si-pass">Password</Label>
                  <Input id="si-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-5">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="su-name">Full name</Label>
                  <Input id="su-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label>I'm joining as</Label>
                  <Select value={userType} onValueChange={(v) => setUserType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional (creator / job seeker)</SelectItem>
                      <SelectItem value="recruiter">Recruiter</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="su-pass">Password</Label>
                  <Input id="su-pass" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
                  <p className="mt-1 text-xs text-muted-foreground">At least 6 characters.</p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account…" : "Join BlueCollar"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you agree to BlueCollar's terms and confirm you have read the platform documentation.
        </p>
      </div>
    </div>
  );
}
