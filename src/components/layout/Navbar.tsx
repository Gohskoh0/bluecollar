import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Bell, Briefcase, Building2, Coins, Home, LogOut, Search, User as UserIcon, Trophy, Star, Users, MessagesSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";
import { useAuth, type Profile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/bluecollar-logo.png";

const NAV = [
  { to: "/feed", icon: Home, label: "Home" },
  { to: "/network", icon: Users, label: "Network" },
  { to: "/jobs", icon: Briefcase, label: "Jobs" },
  { to: "/messages", icon: MessagesSquare, label: "Messaging" },
  { to: "/notifications", icon: Bell, label: "Notifications" },
  { to: "/companies", icon: Building2, label: "Companies" },
  { to: "/wallet", icon: Coins, label: "SONA" },
  { to: "/reputation", icon: Trophy, label: "Reputation" },
];

export function Navbar({ profile }: { profile: Profile | null }) {
  const { signOut } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Link to="/feed" className="flex shrink-0 items-center gap-2">
          <img src={logo} alt="BlueCollar" className="h-8 w-8" width={32} height={32} />
        </Link>
        <div className="relative hidden flex-1 max-w-xs md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search professionals, jobs, companies" className="h-9 pl-9 bg-muted/60 border-0" />
        </div>
        <nav className="ml-auto flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group flex flex-col items-center gap-0.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-primary"
              activeProps={{ "data-status": "active" } as any}
            >
              <item.icon className="h-5 w-5" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          ))}
          <button className="rounded-md p-2 text-muted-foreground hover:text-foreground" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="ml-1 outline-none">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {profile ? initials(profile.full_name) : <UserIcon className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {profile && (
                <>
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-semibold">{profile.full_name}</span>
                      <span className="text-xs font-normal text-muted-foreground">@{profile.username}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.navigate({ to: "/profile/$username", params: { username: profile.username } })}>
                    <UserIcon className="mr-2 h-4 w-4" /> View profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.navigate({ to: "/subscriptions" })}>
                    <Star className="mr-2 h-4 w-4" /> Subscription
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  router.navigate({ to: "/" });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
}
