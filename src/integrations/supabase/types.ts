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
      admin_actions: {
        Row: {
          action: string
          admin_id: string
          amount: number | null
          created_at: string
          id: string
          reason: string | null
          result: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          amount?: number | null
          created_at?: string
          id?: string
          reason?: string | null
          result?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          amount?: number | null
          created_at?: string
          id?: string
          reason?: string | null
          result?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      affiliate_submissions: {
        Row: {
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reward: number
          status: string
          type: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reward: number
          status?: string
          type: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reward?: number
          status?: string
          type?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      deposit_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          plan_id: number
          proof_path: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sender_number: string
          status: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          plan_id: number
          proof_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_number: string
          status?: string
          transaction_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          plan_id?: number
          proof_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_number?: string
          status?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          completed_at: string | null
          created_at: string
          end_date: string
          id: string
          principal: number
          return_amount: number
          return_rate: number
          start_date: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          end_date: string
          id?: string
          principal: number
          return_amount: number
          return_rate?: number
          start_date?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          end_date?: string
          id?: string
          principal?: number
          return_amount?: number
          return_rate?: number
          start_date?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      ledger_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string
          id: string
          reference: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string
          id?: string
          reference?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string
          id?: string
          reference?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          daily_income: number
          daily_task_count: number
          duration_days: number
          id: number
          name: string
          price: number
          sort_order: number
          task_value: number
          total_task_income: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_income: number
          daily_task_count: number
          duration_days?: number
          id: number
          name: string
          price: number
          sort_order?: number
          task_value: number
          total_task_income: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_income?: number
          daily_task_count?: number
          duration_days?: number
          id?: number
          name?: string
          price?: number
          sort_order?: number
          task_value?: number
          total_task_income?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number
          blocked: boolean
          created_at: string
          district: string
          email: string
          full_name: string
          id: string
          phone: string
          province: string
          public_id: string
          referral_code: string
          referred_by: string | null
          registration_bonus_received: boolean
          wallet_number: string
        }
        Insert: {
          avatar_url?: string | null
          balance?: number
          blocked?: boolean
          created_at?: string
          district?: string
          email?: string
          full_name?: string
          id: string
          phone?: string
          province?: string
          public_id: string
          referral_code: string
          referred_by?: string | null
          registration_bonus_received?: boolean
          wallet_number?: string
        }
        Update: {
          avatar_url?: string | null
          balance?: number
          blocked?: boolean
          created_at?: string
          district?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          province?: string
          public_id?: string
          referral_code?: string
          referred_by?: string | null
          registration_bonus_received?: boolean
          wallet_number?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          bonus: number
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          max_uses: number
          updated_at: string
          uses_count: number
        }
        Insert: {
          active?: boolean
          bonus?: number
          code: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          max_uses?: number
          updated_at?: string
          uses_count?: number
        }
        Update: {
          active?: boolean
          bonus?: number
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          max_uses?: number
          updated_at?: string
          uses_count?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          bonus_value: number
          code_id: string
          created_at: string
          id: string
          ip_hash: string | null
          redeemed_at: string
          status: string
          user_id: string
        }
        Insert: {
          bonus_value: number
          code_id: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          redeemed_at?: string
          status?: string
          user_id: string
        }
        Update: {
          bonus_value?: number
          code_id?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          redeemed_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          reward_amount: number
          rewarded: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          reward_amount?: number
          rewarded?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_amount?: number
          rewarded?: boolean
        }
        Relationships: []
      }
      roulette_spins: {
        Row: {
          cost: number
          created_at: string
          id: string
          prize: number
          spin_index: number
          user_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          id?: string
          prize?: number
          spin_index: number
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          prize?: number
          spin_index?: number
          user_id?: string
        }
        Relationships: []
      }
      share_rewards: {
        Row: {
          amount: number
          claimed_at: string | null
          created_at: string
          expires_at: string
          granted_by: string | null
          id: string
          reward_date: string
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          claimed_at?: string | null
          created_at?: string
          expires_at: string
          granted_by?: string | null
          id?: string
          reward_date: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          claimed_at?: string | null
          created_at?: string
          expires_at?: string
          granted_by?: string | null
          id?: string
          reward_date?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_claims: {
        Row: {
          amount: number
          created_at: string
          id: string
          task_date: string
          task_index: number
          user_id: string
          user_plan_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          task_date: string
          task_index: number
          user_id: string
          user_plan_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          task_date?: string
          task_index?: number
          user_id?: string
          user_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_claims_user_plan_id_fkey"
            columns: ["user_plan_id"]
            isOneToOne: false
            referencedRelation: "user_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plans: {
        Row: {
          created_at: string
          end_date: string
          id: string
          plan_id: number
          start_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          plan_id: number
          start_date: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          plan_id?: number
          start_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
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
          role: Database["public"]["Enums"]["app_role"]
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
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          fee: number
          id: string
          net_amount: number
          phone: string
          reference: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fee: number
          id?: string
          net_amount: number
          phone: string
          reference: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee?: number
          id?: string
          net_amount?: number
          phone?: string
          reference?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_ledger: {
        Args: {
          _amount: number
          _description: string
          _reference: string
          _type: string
          _user_id: string
        }
        Returns: number
      }
      claim_share_reward: { Args: { _reward_id: string }; Returns: Json }
      claim_task: { Args: { _task_index: number }; Returns: Json }
      expire_plans: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_due_donations: { Args: never; Returns: number }
      redeem_promo_code: {
        Args: { _code: string; _ip_hash?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
