import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelative(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString();
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export const ACTION_WEIGHTS: Record<string, { weight: number; pool: string }> = {
  like: { weight: 1, pool: "content" },
  profile_visit: { weight: 2, pool: "content" },
  comment: { weight: 3, pool: "community" },
  share: { weight: 5, pool: "content" },
  job_application: { weight: 6, pool: "hiring" },
  referral_click: { weight: 8, pool: "growth" },
  verified_interaction: { weight: 10, pool: "skill" },
  successful_hire: { weight: 25, pool: "hiring" },
};

export const PLAN_MULTIPLIER: Record<string, number> = {
  free: 0,
  pro: 1.0,
  expert: 1.5,
  recruiter_pro: 0,
  recruiter_expert: 0,
};
