export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          applicant_id: string
          cover_letter: string | null
          created_at: string
          id: string
          job_id: string
          status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          applicant_id: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id: string
          status?: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          applicant_id?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id?: string
          status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          growth_pool_goal: number | null
          growth_pool_raised: number
          id: string
          industry: string | null
          location: string | null
          logo_url: string | null
          name: string
          owner_id: string
          ranking_score: number
          size_range: string | null
          slug: string
          tagline: string | null
          updated_at: string
          verified: boolean
          website: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          growth_pool_goal?: number | null
          growth_pool_raised?: number
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          ranking_score?: number
          size_range?: string | null
          slug: string
          tagline?: string | null
          updated_at?: string
          verified?: boolean
          website?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          growth_pool_goal?: number | null
          growth_pool_raised?: number
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          ranking_score?: number
          size_range?: string | null
          slug?: string
          tagline?: string | null
          updated_at?: string
          verified?: boolean
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_contributions: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_contributions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          application_count: number
          company_id: string | null
          created_at: string
          description: string
          featured: boolean
          id: string
          is_open: boolean
          job_type: Database["public"]["Enums"]["job_type"]
          location: string | null
          posted_by: string
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          skills_required: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          application_count?: number
          company_id?: string | null
          created_at?: string
          description: string
          featured?: boolean
          id?: string
          is_open?: boolean
          job_type?: Database["public"]["Enums"]["job_type"]
          location?: string | null
          posted_by: string
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          skills_required?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          application_count?: number
          company_id?: string | null
          created_at?: string
          description?: string
          featured?: boolean
          id?: string
          is_open?: boolean
          job_type?: Database["public"]["Enums"]["job_type"]
          location?: string | null
          posted_by?: string
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          skills_required?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      paystack_transactions: {
        Row: {
          amount_kobo: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          plan: string
          raw: Json | null
          reference: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          plan: string
          raw?: Json | null
          reference: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          plan?: string
          raw?: Json | null
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string
          comment_count: number
          content: string
          created_at: string
          id: string
          image_url: string | null
          like_count: number
          share_count: number
        }
        Insert: {
          author_id: string
          comment_count?: number
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          like_count?: number
          share_count?: number
        }
        Update: {
          author_id?: string
          comment_count?: number
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          like_count?: number
          share_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          follower_count: number
          following_count: number
          full_name: string
          headline: string | null
          id: string
          kyc_verified: boolean
          location: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          profile_completeness: number
          qes_score: number
          reputation_score: number
          skills: string[] | null
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"]
          username: string
          verified_badge: boolean
          work_history: Json | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          follower_count?: number
          following_count?: number
          full_name: string
          headline?: string | null
          id: string
          kyc_verified?: boolean
          location?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          profile_completeness?: number
          qes_score?: number
          reputation_score?: number
          skills?: string[] | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
          username: string
          verified_badge?: boolean
          work_history?: Json | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          follower_count?: number
          following_count?: number
          full_name?: string
          headline?: string | null
          id?: string
          kyc_verified?: boolean
          location?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          profile_completeness?: number
          qes_score?: number
          reputation_score?: number
          skills?: string[] | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
          username?: string
          verified_badge?: boolean
          work_history?: Json | null
        }
        Relationships: []
      }
      reward_events: {
        Row: {
          action: string
          created_at: string
          id: string
          pool: string
          user_id: string
          weight: number
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          pool?: string
          user_id: string
          weight: number
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          pool?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "reward_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sona_wallets: {
        Row: {
          airdrop_claimed: boolean
          airdrop_eligible: boolean
          airdrop_eligible_at: string | null
          devnet_funded_at: string | null
          encrypted_secret: string | null
          lifetime_earned: number
          pending_balance: number
          solana_pubkey: string | null
          updated_at: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          airdrop_claimed?: boolean
          airdrop_eligible?: boolean
          airdrop_eligible_at?: string | null
          devnet_funded_at?: string | null
          encrypted_secret?: string | null
          lifetime_earned?: number
          pending_balance?: number
          solana_pubkey?: string | null
          updated_at?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          airdrop_claimed?: boolean
          airdrop_eligible?: boolean
          airdrop_eligible_at?: string | null
          devnet_funded_at?: string | null
          encrypted_secret?: string | null
          lifetime_earned?: number
          pending_balance?: number
          solana_pubkey?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sona_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sona_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string | null
          follower_count: number | null
          following_count: number | null
          full_name: string | null
          headline: string | null
          id: string | null
          location: string | null
          qes_score: number | null
          reputation_score: number | null
          skills: string[] | null
          updated_at: string | null
          user_type: Database["public"]["Enums"]["user_type"] | null
          username: string | null
          verified_badge: boolean | null
          work_history: Json | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          follower_count?: number | null
          following_count?: number | null
          full_name?: string | null
          headline?: string | null
          id?: string | null
          location?: string | null
          qes_score?: number | null
          reputation_score?: number | null
          skills?: string[] | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"] | null
          username?: string | null
          verified_badge?: boolean | null
          work_history?: Json | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          follower_count?: number | null
          following_count?: number | null
          full_name?: string | null
          headline?: string | null
          id?: string | null
          location?: string | null
          qes_score?: number | null
          reputation_score?: number | null
          skills?: string[] | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"] | null
          username?: string | null
          verified_badge?: boolean | null
          work_history?: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      application_status:
        | "pending"
        | "reviewed"
        | "interview"
        | "hired"
        | "rejected"
      job_type: "full_time" | "part_time" | "contract" | "internship" | "remote"
      subscription_plan:
        | "free"
        | "pro"
        | "expert"
        | "recruiter_pro"
        | "recruiter_expert"
      user_type: "professional" | "recruiter" | "company"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      application_status: [
        "pending",
        "reviewed",
        "interview",
        "hired",
        "rejected",
      ],
      job_type: ["full_time", "part_time", "contract", "internship", "remote"],
      subscription_plan: [
        "free",
        "pro",
        "expert",
        "recruiter_pro",
        "recruiter_expert",
      ],
      user_type: ["professional", "recruiter", "company"],
    },
  },
} as const
