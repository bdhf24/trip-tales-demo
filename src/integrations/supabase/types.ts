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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      image_library: {
        Row: {
          art_style: string
          characters: Json
          created_at: string | null
          id: string
          image_url: string
          landmark: string | null
          last_reused_at: string | null
          location: string | null
          mood: string
          page_id: string | null
          quality_score: number | null
          reuse_count: number | null
          scene_type: string
          tags: string[] | null
          time_of_day: string | null
          user_rating: number | null
        }
        Insert: {
          art_style: string
          characters: Json
          created_at?: string | null
          id?: string
          image_url: string
          landmark?: string | null
          last_reused_at?: string | null
          location?: string | null
          mood: string
          page_id?: string | null
          quality_score?: number | null
          reuse_count?: number | null
          scene_type: string
          tags?: string[] | null
          time_of_day?: string | null
          user_rating?: number | null
        }
        Update: {
          art_style?: string
          characters?: Json
          created_at?: string | null
          id?: string
          image_url?: string
          landmark?: string | null
          last_reused_at?: string | null
          location?: string | null
          mood?: string
          page_id?: string | null
          quality_score?: number | null
          reuse_count?: number | null
          scene_type?: string
          tags?: string[] | null
          time_of_day?: string | null
          user_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "image_library_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: true
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      kid_photos: {
        Row: {
          created_at: string
          id: string
          image_url: string
          kid_id: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          kid_id: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          kid_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kid_photos_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
        ]
      }
      kids: {
        Row: {
          age: number
          appearance_notes: string | null
          created_at: string
          descriptor: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          age: number
          appearance_notes?: string | null
          created_at?: string
          descriptor?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number
          appearance_notes?: string | null
          created_at?: string
          descriptor?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          created_at: string
          heading: string
          id: string
          image_prompt: string
          image_prompt_spec: Json
          image_url: string | null
          page_number: number
          story_id: string
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          heading: string
          id?: string
          image_prompt: string
          image_prompt_spec: Json
          image_url?: string | null
          page_number: number
          story_id: string
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          heading?: string
          id?: string
          image_prompt?: string
          image_prompt_spec?: Json
          image_url?: string | null
          page_number?: number
          story_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_exports: {
        Row: {
          created_at: string
          hash: string
          id: string
          pdf_url: string
          story_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hash: string
          id?: string
          pdf_url: string
          story_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hash?: string
          id?: string
          pdf_url?: string
          story_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_exports_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_images: {
        Row: {
          created_at: string
          id: string
          kid_id: string
          notes: string | null
          page_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kid_id: string
          notes?: string | null
          page_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kid_id?: string
          notes?: string | null
          page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_images_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_images_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          art_style: string
          cost_saved: number | null
          created_at: string
          destination: string
          estimated_cost: number | null
          id: string
          images_generated: number | null
          images_reused: number | null
          interests: string[]
          kids_json: Json
          length: number
          month: string
          outline_json: Json
          title: string
          tone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          art_style: string
          cost_saved?: number | null
          created_at?: string
          destination: string
          estimated_cost?: number | null
          id?: string
          images_generated?: number | null
          images_reused?: number | null
          interests?: string[]
          kids_json: Json
          length: number
          month: string
          outline_json: Json
          title: string
          tone: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          art_style?: string
          cost_saved?: number | null
          created_at?: string
          destination?: string
          estimated_cost?: number | null
          id?: string
          images_generated?: number | null
          images_reused?: number | null
          interests?: string[]
          kids_json?: Json
          length?: number
          month?: string
          outline_json?: Json
          title?: string
          tone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
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
