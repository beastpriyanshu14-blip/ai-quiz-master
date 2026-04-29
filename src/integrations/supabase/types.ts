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
      live_answers: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          participant_id: string
          points_earned: number
          question_id: string
          question_order_index: number
          room_id: string
          selected_answer: string | null
          time_taken_ms: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          participant_id: string
          points_earned?: number
          question_id: string
          question_order_index: number
          room_id: string
          selected_answer?: string | null
          time_taken_ms?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          participant_id?: string
          points_earned?: number
          question_id?: string
          question_order_index?: number
          room_id?: string
          selected_answer?: string | null
          time_taken_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_answers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "live_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_answers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "live_participants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "live_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_answers_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_answers_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      live_participants: {
        Row: {
          display_name: string
          id: string
          is_kicked: boolean
          joined_at: string
          last_seen_at: string
          participant_token: string
          room_id: string
          score: number
        }
        Insert: {
          display_name: string
          id?: string
          is_kicked?: boolean
          joined_at?: string
          last_seen_at?: string
          participant_token: string
          room_id: string
          score?: number
        }
        Update: {
          display_name?: string
          id?: string
          is_kicked?: boolean
          joined_at?: string
          last_seen_at?: string
          participant_token?: string
          room_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      live_questions: {
        Row: {
          correct_answer: string
          created_at: string
          explanation: string
          id: string
          options: Json
          order_index: number
          question: string
          room_id: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          explanation?: string
          id?: string
          options: Json
          order_index: number
          question: string
          room_id: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          explanation?: string
          id?: string
          options?: Json
          order_index?: number
          question?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_questions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_questions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      live_rooms: {
        Row: {
          code: string
          created_at: string
          current_question_index: number
          difficulty: string
          host_name: string
          host_token: string
          id: string
          max_participants: number | null
          password: string
          question_started_at: string | null
          reveal_results: boolean
          seconds_per_question: number
          status: string
          topic: string
          total_questions: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          current_question_index?: number
          difficulty?: string
          host_name: string
          host_token: string
          id?: string
          max_participants?: number | null
          password: string
          question_started_at?: string | null
          reveal_results?: boolean
          seconds_per_question?: number
          status?: string
          topic: string
          total_questions?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          current_question_index?: number
          difficulty?: string
          host_name?: string
          host_token?: string
          id?: string
          max_participants?: number | null
          password?: string
          question_started_at?: string | null
          reveal_results?: boolean
          seconds_per_question?: number
          status?: string
          topic?: string
          total_questions?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      live_participants_public: {
        Row: {
          display_name: string | null
          id: string | null
          is_kicked: boolean | null
          joined_at: string | null
          last_seen_at: string | null
          room_id: string | null
          score: number | null
        }
        Insert: {
          display_name?: string | null
          id?: string | null
          is_kicked?: boolean | null
          joined_at?: string | null
          last_seen_at?: string | null
          room_id?: string | null
          score?: number | null
        }
        Update: {
          display_name?: string | null
          id?: string | null
          is_kicked?: boolean | null
          joined_at?: string | null
          last_seen_at?: string | null
          room_id?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "live_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      live_rooms_public: {
        Row: {
          code: string | null
          created_at: string | null
          current_question_index: number | null
          difficulty: string | null
          host_name: string | null
          id: string | null
          max_participants: number | null
          question_started_at: string | null
          reveal_results: boolean | null
          seconds_per_question: number | null
          status: string | null
          topic: string | null
          total_questions: number | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          current_question_index?: number | null
          difficulty?: string | null
          host_name?: string | null
          id?: string | null
          max_participants?: number | null
          question_started_at?: string | null
          reveal_results?: boolean | null
          seconds_per_question?: number | null
          status?: string | null
          topic?: string | null
          total_questions?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          current_question_index?: number | null
          difficulty?: string | null
          host_name?: string | null
          id?: string | null
          max_participants?: number | null
          question_started_at?: string | null
          reveal_results?: boolean | null
          seconds_per_question?: number | null
          status?: string | null
          topic?: string | null
          total_questions?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _assert_host: {
        Args: { p_host_token: string; p_room_id: string }
        Returns: {
          code: string
          created_at: string
          current_question_index: number
          difficulty: string
          host_name: string
          host_token: string
          id: string
          max_participants: number | null
          password: string
          question_started_at: string | null
          reveal_results: boolean
          seconds_per_question: number
          status: string
          topic: string
          total_questions: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "live_rooms"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _req_host_token: { Args: never; Returns: string }
      _req_participant_token: { Args: never; Returns: string }
      create_live_room: {
        Args: {
          p_code: string
          p_difficulty: string
          p_host_name: string
          p_host_token: string
          p_max_participants: number
          p_password: string
          p_questions: Json
          p_seconds_per_question: number
          p_topic: string
        }
        Returns: Json
      }
      get_room_public: {
        Args: { p_room_id: string }
        Returns: {
          code: string
          created_at: string
          current_question_index: number
          difficulty: string
          host_name: string
          id: string
          max_participants: number
          question_started_at: string
          reveal_results: boolean
          seconds_per_question: number
          status: string
          topic: string
          total_questions: number
          updated_at: string
        }[]
      }
      get_room_public_by_code: {
        Args: { p_code: string }
        Returns: {
          code: string
          created_at: string
          current_question_index: number
          difficulty: string
          host_name: string
          id: string
          max_participants: number
          question_started_at: string
          reveal_results: boolean
          seconds_per_question: number
          status: string
          topic: string
          total_questions: number
          updated_at: string
        }[]
      }
      get_room_questions_safe: {
        Args: { p_room_id: string }
        Returns: {
          id: string
          options: Json
          order_index: number
          question: string
          room_id: string
        }[]
      }
      host_advance_question: {
        Args: { p_host_token: string; p_index: number; p_room_id: string }
        Returns: Json
      }
      host_end: {
        Args: { p_host_token: string; p_room_id: string }
        Returns: Json
      }
      host_get_questions: {
        Args: { p_host_token: string; p_room_id: string }
        Returns: {
          correct_answer: string
          explanation: string
          id: string
          options: Json
          order_index: number
          question: string
          room_id: string
        }[]
      }
      host_get_room: {
        Args: { p_host_token: string; p_room_id: string }
        Returns: {
          code: string
          created_at: string
          current_question_index: number
          difficulty: string
          host_name: string
          host_token: string
          id: string
          max_participants: number | null
          password: string
          question_started_at: string | null
          reveal_results: boolean
          seconds_per_question: number
          status: string
          topic: string
          total_questions: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "live_rooms"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      host_kick: {
        Args: {
          p_host_token: string
          p_participant_id: string
          p_room_id: string
        }
        Returns: Json
      }
      host_pause: {
        Args: { p_host_token: string; p_room_id: string }
        Returns: Json
      }
      host_resume: {
        Args: { p_host_token: string; p_room_id: string }
        Returns: Json
      }
      host_reveal: {
        Args: { p_host_token: string; p_room_id: string }
        Returns: Json
      }
      join_live_room: {
        Args: {
          p_code: string
          p_display_name: string
          p_password: string
          p_token: string
        }
        Returns: Json
      }
      submit_live_answer: {
        Args: {
          p_participant_token: string
          p_question_id: string
          p_room_id: string
          p_selected: string
        }
        Returns: Json
      }
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
