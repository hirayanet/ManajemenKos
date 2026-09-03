export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          password_hash: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          password_hash: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          password_hash?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          address: string
          business_name: string
          created_at: string
          id: number
          labels: Json
          logo_url: string | null
          phone: string
          signature_url: string | null
          tagline: string
          updated_at: string
        }
        Insert: {
          address?: string
          business_name?: string
          created_at?: string
          id?: number
          labels?: Json
          logo_url?: string | null
          phone?: string
          signature_url?: string | null
          tagline?: string
          updated_at?: string
        }
        Update: {
          address?: string
          business_name?: string
          created_at?: string
          id?: number
          labels?: Json
          logo_url?: string | null
          phone?: string
          signature_url?: string | null
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_date: string
          payment_method: string
          payment_month: string
          periode_mulai: string | null
          periode_selesai: string | null
          receipt_url: string | null
          resident_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_date: string
          payment_method: string
          payment_month: string
          periode_mulai?: string | null
          periode_selesai?: string | null
          receipt_url?: string | null
          resident_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_date?: string
          payment_method?: string
          payment_month?: string
          periode_mulai?: string | null
          periode_selesai?: string | null
          receipt_url?: string | null
          resident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      dp_reservasi: {
        Row: {
          catatan: string | null
          created_at: string
          deadline_pelunasan: string
          harga_per_bulan: number
          id: string
          nama_calon: string
          nominal_dp: number
          nominal_pelunasan: number
          payment_method_dp: string
          payment_method_pelunasan: string | null
          phone_number: string | null
          receipt_url_dp: string | null
          receipt_url_pelunasan: string | null
          resident_id: string | null
          room_id: number
          status: string
          tanggal_dp: string
          tanggal_pelunasan: string | null
          updated_at: string
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          deadline_pelunasan: string
          harga_per_bulan: number
          id?: string
          nama_calon: string
          nominal_dp: number
          payment_method_dp?: string
          payment_method_pelunasan?: string | null
          phone_number?: string | null
          receipt_url_dp?: string | null
          receipt_url_pelunasan?: string | null
          resident_id?: string | null
          room_id: number
          status?: string
          tanggal_dp: string
          tanggal_pelunasan?: string | null
          updated_at?: string
        }
        Update: {
          catatan?: string | null
          created_at?: string
          deadline_pelunasan?: string
          harga_per_bulan?: number
          id?: string
          nama_calon?: string
          nominal_dp?: number
          payment_method_dp?: string
          payment_method_pelunasan?: string | null
          phone_number?: string | null
          receipt_url_dp?: string | null
          receipt_url_pelunasan?: string | null
          resident_id?: string | null
          room_id?: number
          status?: string
          tanggal_dp?: string
          tanggal_pelunasan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dp_reservasi_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dp_reservasi_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          id: string;
          category: string;
          amount: number;
          expense_date: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          amount: number;
          expense_date: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?: string;
          amount?: number;
          expense_date?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      residents: {
        Row: {
          created_at: string
          entry_date: string
          full_name: string
          id: string
          is_active: boolean
          ktp_image_url: string | null
          marital_status: string | null
          marriage_document_url: string | null
          phone_number: string
          room_id: number
          status_penghuni: string | null
          tanggal_keluar: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entry_date: string
          full_name: string
          id?: string
          is_active?: boolean
          ktp_image_url?: string | null
          marital_status?: string | null
          marriage_document_url?: string | null
          phone_number: string
          room_id: number
          status_penghuni?: string | null
          tanggal_keluar?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          full_name?: string
          id?: string
          is_active?: boolean
          ktp_image_url?: string | null
          marital_status?: string | null
          marriage_document_url?: string | null
          phone_number?: string
          room_id?: number
          status_penghuni?: string | null
          tanggal_keluar?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "residents_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          id: number
          is_occupied: boolean
          room_number: number
        }
        Insert: {
          created_at?: string
          id?: number
          is_occupied?: boolean
          room_number: number
        }
        Update: {
          created_at?: string
          id?: number
          is_occupied?: boolean
          room_number?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
