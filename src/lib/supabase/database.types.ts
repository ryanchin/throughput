export type UserRole = 'employee' | 'sales' | 'admin' | 'public'
export type ContentStatus = 'draft' | 'published'
export type QuestionType = 'multiple_choice' | 'true_false' | 'open_ended'
export type CertQuestionType = 'multiple_choice' | 'open_ended'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Zone = 'training' | 'sales'
export type NavigationMode = 'sequential' | 'free'
export type EnrollmentStatus = 'enrolled' | 'passed' | 'failed'
export type Visibility = 'public' | 'internal' | `group:${string}`
export type DocsPageType = 'knowledge' | 'docs'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: UserRole
          signup_context: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: UserRole
          signup_context?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: UserRole
          signup_context?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          id: string
          title: string
          description: string | null
          slug: string
          zone: Zone
          status: ContentStatus
          cover_image_url: string | null
          learning_objectives: string[] | null
          passing_score: number
          navigation_mode: NavigationMode
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          slug: string
          zone?: Zone
          status?: ContentStatus
          cover_image_url?: string | null
          learning_objectives?: string[] | null
          passing_score?: number
          navigation_mode?: NavigationMode
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          slug?: string
          zone?: Zone
          status?: ContentStatus
          cover_image_url?: string | null
          learning_objectives?: string[] | null
          passing_score?: number
          navigation_mode?: NavigationMode
          updated_at?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          id: string
          course_id: string
          title: string
          slug: string
          content: Json | null
          order_index: number
          status: ContentStatus
          video_ids: string[]
          duration_minutes: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          slug: string
          content?: Json | null
          order_index?: number
          status?: ContentStatus
          video_ids?: string[]
          duration_minutes?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          slug?: string
          content?: Json | null
          order_index?: number
          status?: ContentStatus
          video_ids?: string[]
          duration_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          id: string
          lesson_id: string
          title: string | null
          passing_score: number
          max_attempts: number | null
          created_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          title?: string | null
          passing_score?: number
          max_attempts?: number | null
          created_at?: string
        }
        Update: {
          title?: string | null
          passing_score?: number
          max_attempts?: number | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          id: string
          quiz_id: string
          question_text: string
          question_type: QuestionType
          options: Json | null
          correct_answer: string | null
          rubric: string | null
          max_points: number
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          quiz_id: string
          question_text: string
          question_type: QuestionType
          options?: Json | null
          correct_answer?: string | null
          rubric?: string | null
          max_points?: number
          order_index?: number
          created_at?: string
        }
        Update: {
          question_text?: string
          question_type?: QuestionType
          options?: Json | null
          correct_answer?: string | null
          rubric?: string | null
          max_points?: number
          order_index?: number
        }
        Relationships: []
      }
      course_enrollments: {
        Row: {
          id: string
          user_id: string
          course_id: string
          status: EnrollmentStatus
          final_score: number | null
          enrolled_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          status?: EnrollmentStatus
          final_score?: number | null
          enrolled_at?: string
          completed_at?: string | null
        }
        Update: {
          status?: EnrollmentStatus
          final_score?: number | null
          completed_at?: string | null
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          started_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          lesson_id: string
          started_at?: string
          completed_at?: string | null
        }
        Update: {
          completed_at?: string | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          id: string
          user_id: string
          quiz_id: string
          attempt_number: number
          score: number | null
          passed: boolean | null
          started_at: string
          submitted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          quiz_id: string
          attempt_number?: number
          score?: number | null
          passed?: boolean | null
          started_at?: string
          submitted_at?: string | null
        }
        Update: {
          score?: number | null
          passed?: boolean | null
          submitted_at?: string | null
        }
        Relationships: []
      }
      question_responses: {
        Row: {
          id: string
          attempt_id: string
          question_id: string
          user_answer: string | null
          is_correct: boolean | null
          points_earned: number
          llm_feedback: string | null
          graded_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          attempt_id: string
          question_id: string
          user_answer?: string | null
          is_correct?: boolean | null
          points_earned?: number
          llm_feedback?: string | null
          graded_at?: string | null
          created_at?: string
        }
        Update: {
          is_correct?: boolean | null
          points_earned?: number
          llm_feedback?: string | null
          graded_at?: string | null
        }
        Relationships: []
      }
      docs_pages: {
        Row: {
          id: string
          title: string
          slug: string
          content: Json | null
          parent_id: string | null
          order_index: number
          status: ContentStatus
          visibility: Visibility
          type: DocsPageType
          search_vector: unknown
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          content?: Json | null
          parent_id?: string | null
          order_index?: number
          status?: ContentStatus
          visibility?: Visibility
          type?: DocsPageType
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          slug?: string
          content?: Json | null
          parent_id?: string | null
          order_index?: number
          status?: ContentStatus
          visibility?: Visibility
          type?: DocsPageType
          updated_at?: string
        }
        Relationships: []
      }
      certification_tracks: {
        Row: {
          id: string
          title: string
          slug: string
          tier: number
          domain: string | null
          description: string | null
          prerequisite_track_id: string | null
          passing_score: number
          exam_duration_minutes: number
          question_pool_size: number
          questions_per_exam: number
          status: ContentStatus
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          tier: number
          domain?: string | null
          description?: string | null
          prerequisite_track_id?: string | null
          passing_score?: number
          exam_duration_minutes?: number
          question_pool_size?: number
          questions_per_exam?: number
          status?: ContentStatus
          created_at?: string
        }
        Update: {
          title?: string
          slug?: string
          tier?: number
          domain?: string | null
          description?: string | null
          prerequisite_track_id?: string | null
          passing_score?: number
          exam_duration_minutes?: number
          question_pool_size?: number
          questions_per_exam?: number
          status?: ContentStatus
        }
        Relationships: []
      }
      cert_questions: {
        Row: {
          id: string
          track_id: string
          question_text: string
          question_type: CertQuestionType
          options: Json | null
          correct_answer: string | null
          rubric: string | null
          max_points: number
          difficulty: Difficulty
          tags: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          track_id: string
          question_text: string
          question_type: CertQuestionType
          options?: Json | null
          correct_answer?: string | null
          rubric?: string | null
          max_points?: number
          difficulty?: Difficulty
          tags?: string[] | null
          created_at?: string
        }
        Update: {
          question_text?: string
          question_type?: CertQuestionType
          options?: Json | null
          correct_answer?: string | null
          rubric?: string | null
          max_points?: number
          difficulty?: Difficulty
          tags?: string[] | null
        }
        Relationships: []
      }
      cert_attempts: {
        Row: {
          id: string
          user_id: string
          track_id: string
          attempt_number: number
          question_ids: string[] | null
          score: number | null
          passed: boolean | null
          started_at: string
          submitted_at: string | null
          expires_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          track_id: string
          attempt_number?: number
          question_ids?: string[] | null
          score?: number | null
          passed?: boolean | null
          started_at?: string
          submitted_at?: string | null
          expires_at?: string | null
        }
        Update: {
          score?: number | null
          passed?: boolean | null
          submitted_at?: string | null
          expires_at?: string | null
        }
        Relationships: []
      }
      certificates: {
        Row: {
          id: string
          user_id: string
          track_id: string
          attempt_id: string | null
          cert_number: string
          verification_hash: string
          issued_at: string
          expires_at: string | null
          revoked: boolean
          revoked_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          track_id: string
          attempt_id?: string | null
          cert_number: string
          verification_hash: string
          issued_at?: string
          expires_at?: string | null
          revoked?: boolean
          revoked_at?: string | null
        }
        Update: {
          expires_at?: string | null
          revoked?: boolean
          revoked_at?: string | null
        }
        Relationships: []
      }
      sales_materials: {
        Row: {
          id: string
          title: string
          slug: string
          description: string | null
          material_type: string
          category: string | null
          tags: string[]
          content: Json | null
          file_path: string | null
          file_name: string | null
          file_size_bytes: number | null
          file_mime_type: string | null
          shareable: boolean
          share_token: string | null
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          description?: string | null
          material_type: string
          category?: string | null
          tags?: string[]
          content?: Json | null
          file_path?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_mime_type?: string | null
          shareable?: boolean
          share_token?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          slug?: string
          description?: string | null
          material_type?: string
          category?: string | null
          tags?: string[]
          content?: Json | null
          file_path?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_mime_type?: string | null
          shareable?: boolean
          share_token?: string | null
          status?: string
        }
        Relationships: []
      }
      sales_material_categories: {
        Row: {
          id: string
          name: string
          slug: string
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          order_index?: number
          created_at?: string
        }
        Update: {
          name?: string
          slug?: string
          order_index?: number
        }
        Relationships: []
      }
      user_groups: {
        Row: {
          user_id: string
          group_name: string
          added_by: string | null
          added_at: string
        }
        Insert: {
          user_id: string
          group_name: string
          added_by?: string | null
          added_at?: string
        }
        Update: {
          added_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
