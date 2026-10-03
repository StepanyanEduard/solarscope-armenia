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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          action: string
          condition_from: number | null
          condition_to: number | null
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          rule: string
          severity: string
          station_id: string
          status: string
          title: string
        }
        Insert: {
          action?: string
          condition_from?: number | null
          condition_to?: number | null
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          rule: string
          severity: string
          station_id: string
          status?: string
          title: string
        }
        Update: {
          action?: string
          condition_from?: number | null
          condition_to?: number | null
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          rule?: string
          severity?: string
          station_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          id: string
          kind: string
          name: string
          url: string | null
        }
        Insert: {
          id: string
          kind: string
          name: string
          url?: string | null
        }
        Update: {
          id?: string
          kind?: string
          name?: string
          url?: string | null
        }
        Relationships: []
      }
      observations: {
        Row: {
          cloud_cover: number | null
          condition_score: number
          created_at: string
          f_anomaly: number
          f_change: number
          f_quality: number
          f_trend: number
          id: string
          is_demo: boolean
          observed_at: string
          quality: string
          source_id: string | null
          station_id: string
        }
        Insert: {
          cloud_cover?: number | null
          condition_score: number
          created_at?: string
          f_anomaly?: number
          f_change?: number
          f_quality?: number
          f_trend?: number
          id?: string
          is_demo?: boolean
          observed_at: string
          quality?: string
          source_id?: string | null
          station_id: string
        }
        Update: {
          cloud_cover?: number | null
          condition_score?: number
          created_at?: string
          f_anomaly?: number
          f_change?: number
          f_quality?: number
          f_trend?: number
          id?: string
          is_demo?: boolean
          observed_at?: string
          quality?: string
          source_id?: string | null
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      problems: {
        Row: {
          action: string
          affected_pct: number | null
          category: string
          confidence: number
          created_at: string
          description: string
          detected_at: string
          id: string
          is_demo: boolean
          severity: string
          station_id: string
          status: string
        }
        Insert: {
          action?: string
          affected_pct?: number | null
          category: string
          confidence?: number
          created_at?: string
          description: string
          detected_at?: string
          id?: string
          is_demo?: boolean
          severity: string
          station_id: string
          status?: string
        }
        Update: {
          action?: string
          affected_pct?: number | null
          category?: string
          confidence?: number
          created_at?: string
          description?: string
          detected_at?: string
          id?: string
          is_demo?: boolean
          severity?: string
          station_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "problems_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      provinces: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      stations: {
        Row: {
          capacity_mw: number | null
          commissioning_date: string | null
          created_at: string
          data_mode: string
          geometry: Json | null
          id: string
          lat: number
          lng: number
          municipality: string | null
          name: string
          operator: string | null
          province_id: string
          source_id: string | null
          station_type: string
          verification: string
        }
        Insert: {
          capacity_mw?: number | null
          commissioning_date?: string | null
          created_at?: string
          data_mode?: string
          geometry?: Json | null
          id: string
          lat: number
          lng: number
          municipality?: string | null
          name: string
          operator?: string | null
          province_id: string
          source_id?: string | null
          station_type?: string
          verification?: string
        }
        Update: {
          capacity_mw?: number | null
          commissioning_date?: string | null
          created_at?: string
          data_mode?: string
          geometry?: Json | null
          id?: string
          lat?: number
          lng?: number
          municipality?: string | null
          name?: string
          operator?: string | null
          province_id?: string
          source_id?: string | null
          station_type?: string
          verification?: string
        }
        Relationships: [
          {
            foreignKeyName: "stations_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
