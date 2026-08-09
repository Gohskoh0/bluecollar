// Feature gating tied to user_type (professional / recruiter) and paid entitlements.
//
// Monetization model (v2):
//  - SONA is no longer distributed via monthly subscriptions. Users buy HASH RATE
//    (a one-time, permanent purchase) which mines SONA continuously.
//  - Recruiters can subscribe to Recruiter Pro ($24 / mo) for advanced hiring tools.
//  - Creating a company requires an active Company Licence ($199.80 / mo).

import type { Profile } from "@/hooks/useAuth";

export type Plan = Profile["plan"];
export type UserType = Profile["user_type"];

/* ------------------------------- Pricing -------------------------------- */

export const USD = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Recruiter Pro subscription — advanced recruiting features. */
export const RECRUITER_PRO_CENTS = 2400;

/** Company Licence — required to create and operate a company. */
export const COMPANY_LICENSE_CENTS = 19980;

/** SONA mined per GH/s per day. Deliberately low: scarce distribution, real revenue. */
export const MINING_RATE_PER_GHS_PER_DAY = 0.05;

export interface HashPack {
  id: string;
  name: string;
  ghs: number;
  cents: number;
  featured?: boolean;
  blurb: string;
}

/** Hash rate packs. Permanent capacity — buy once, mine forever. */
export const HASH_PACKS: HashPack[] = [
  { id: "spark", name: "Spark", ghs: 10, cents: 999, blurb: "Entry mining capacity to start earning SONA." },
  { id: "surge", name: "Surge", ghs: 50, cents: 3999, blurb: "5× the capacity for steady daily yield." },
  { id: "core", name: "Core", ghs: 150, cents: 9999, featured: true, blurb: "Best value per GH/s for serious earners." },
  { id: "forge", name: "Forge", ghs: 500, cents: 29999, blurb: "Maximum capacity for power users and teams." },
];

export function findHashPack(id: string) {
  return HASH_PACKS.find((p) => p.id === id);
}

/** SONA per day for a given hash rate. */
export function dailyYield(hashRate: number) {
  return hashRate * MINING_RATE_PER_GHS_PER_DAY;
}

/* ------------------------------- Features ------------------------------- */

export interface FeatureSet {
  // Professional / freelancer
  canPost: boolean;
  canApplyJob: boolean;
  canMine: boolean;
  canStake: boolean;
  applicationsPerMonth: number; // -1 = unlimited

  // Recruiter
  canPostJob: boolean;
  canMessageProfessionals: boolean;
  advancedFilters: boolean;
  featuredJobPlacement: boolean;
  jobsPerMonth: number;

  // Company (licence-gated)
  canCreateCompany: boolean;
  canManageCompany: boolean;
}

const baseProfessional: FeatureSet = {
  canPost: true,
  canApplyJob: true,
  canMine: true,
  canStake: true,
  applicationsPerMonth: -1,
  canPostJob: false,
  canMessageProfessionals: false,
  advancedFilters: false,
  featuredJobPlacement: false,
  jobsPerMonth: 0,
  canCreateCompany: false,
  canManageCompany: false,
};

const baseRecruiter: FeatureSet = {
  ...baseProfessional,
  canApplyJob: false,
  applicationsPerMonth: 0,
  canPostJob: true,
  jobsPerMonth: 3,
};

export interface Entitlements {
  /** Active company licence — required to create / operate companies. */
  companyLicense?: boolean;
}

export function getFeatures(profile: Profile | null, ent: Entitlements = {}): FeatureSet {
  if (!profile) return baseProfessional;
  const isRecruiter = profile.user_type !== "professional";
  const base = isRecruiter ? baseRecruiter : baseProfessional;

  const recruiterPro = isRecruiter && (profile.plan === "recruiter_pro" || profile.plan === "recruiter_expert");

  return {
    ...base,
    ...(recruiterPro
      ? {
          canMessageProfessionals: true,
          advancedFilters: true,
          featuredJobPlacement: true,
          jobsPerMonth: -1,
        }
      : {}),
    // Any user type can create a company — the licence is what gates it.
    canCreateCompany: !!ent.companyLicense,
    canManageCompany: !!ent.companyLicense,
  };
}

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  expert: "Expert",
  recruiter_pro: "Recruiter Pro",
  recruiter_expert: "Recruiter Pro",
};

export const USER_TYPE_LABEL: Record<UserType, string> = {
  professional: "Freelancer / Job seeker",
  recruiter: "Recruiter",
  company: "Recruiter",
};
