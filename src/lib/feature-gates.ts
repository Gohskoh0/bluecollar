// Feature gating tied to user_type (professional / recruiter / company) and plan.
// Mirrors the Sonari documentation: each user type has a specific feature set.

import type { Profile } from "@/hooks/useAuth";

export type Plan = Profile["plan"];
export type UserType = Profile["user_type"];

export const PLAN_MULTIPLIER: Record<Plan, number> = {
  free: 0,
  pro: 1.0,
  expert: 1.5,
  recruiter_pro: 0,
  recruiter_expert: 0,
};

export interface FeatureSet {
  // Professional
  canPost: boolean;
  canApplyJob: boolean;
  monetizationEnabled: boolean; // earn SONA / QES rewards
  verifiedBadge: boolean;
  prioritySearch: boolean;
  applicationsPerMonth: number; // -1 = unlimited

  // Recruiter
  canPostJob: boolean;
  canMessageProfessionals: boolean;
  advancedFilters: boolean;
  featuredJobPlacement: boolean;
  jobsPerMonth: number;

  // Company
  canCreateCompany: boolean;
  growthPoolAccess: boolean;
  verifiedCompanyBadge: boolean;
}

const baseProfessional: FeatureSet = {
  canPost: true,
  canApplyJob: true,
  monetizationEnabled: false,
  verifiedBadge: false,
  prioritySearch: false,
  applicationsPerMonth: 5,
  canPostJob: false,
  canMessageProfessionals: false,
  advancedFilters: false,
  featuredJobPlacement: false,
  jobsPerMonth: 0,
  canCreateCompany: false,
  growthPoolAccess: false,
  verifiedCompanyBadge: false,
};

const baseRecruiter: FeatureSet = {
  ...baseProfessional,
  monetizationEnabled: false,
  applicationsPerMonth: 0,
  canApplyJob: false,
  canPostJob: false,
  canMessageProfessionals: false,
  advancedFilters: false,
  jobsPerMonth: 0,
};

const baseCompany: FeatureSet = {
  ...baseRecruiter,
  canCreateCompany: true,
  growthPoolAccess: false,
  verifiedCompanyBadge: false,
};

export function getFeatures(profile: Profile | null): FeatureSet {
  if (!profile) return baseProfessional;
  const base =
    profile.user_type === "recruiter"
      ? baseRecruiter
      : profile.user_type === "company"
      ? baseCompany
      : baseProfessional;

  switch (profile.plan) {
    case "pro":
      return { ...base, monetizationEnabled: true, applicationsPerMonth: 25 };
    case "expert":
      return {
        ...base,
        monetizationEnabled: true,
        verifiedBadge: true,
        prioritySearch: true,
        applicationsPerMonth: -1,
      };
    case "recruiter_pro":
      return {
        ...base,
        canPostJob: true,
        canMessageProfessionals: true,
        advancedFilters: true,
        jobsPerMonth: 10,
        growthPoolAccess: profile.user_type === "company",
      };
    case "recruiter_expert":
      return {
        ...base,
        canPostJob: true,
        canMessageProfessionals: true,
        advancedFilters: true,
        featuredJobPlacement: true,
        jobsPerMonth: -1,
        growthPoolAccess: true,
        verifiedCompanyBadge: profile.user_type === "company",
      };
    default:
      return base;
  }
}

export const PLAN_PRICE_NGN: Record<Exclude<Plan, "free">, number> = {
  pro: 9990,
  expert: 24990,
  recruiter_pro: 49000,
  recruiter_expert: 199000,
};

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  expert: "Expert",
  recruiter_pro: "Recruiter Pro",
  recruiter_expert: "Recruiter Expert",
};
