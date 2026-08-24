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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_profile_suggestions: {
        Row: {
          created_at: string
          current_value: Json | null
          entity_type: string
          field: string
          id: string
          label: string
          rationale: string | null
          source: string
          status: string
          suggested_value: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: Json | null
          entity_type: string
          field: string
          id?: string
          label: string
          rationale?: string | null
          source?: string
          status?: string
          suggested_value: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: Json | null
          entity_type?: string
          field?: string
          id?: string
          label?: string
          rationale?: string | null
          source?: string
          status?: string
          suggested_value?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_reviews: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          model: string | null
          payload: Json
          status: string
          subject_id: string | null
          subject_type: string
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          model?: string | null
          payload?: Json
          status?: string
          subject_id?: string | null
          subject_type: string
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          model?: string | null
          payload?: Json
          status?: string
          subject_id?: string | null
          subject_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_contacts: {
        Row: {
          brand_id: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_contacts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_dna: {
        Row: {
          brand_id: string
          confidence: number | null
          created_at: string
          data: Json
          id: string
          model: string | null
          reviewed_by_user: boolean
          updated_at: string
        }
        Insert: {
          brand_id: string
          confidence?: number | null
          created_at?: string
          data?: Json
          id?: string
          model?: string | null
          reviewed_by_user?: boolean
          updated_at?: string
        }
        Update: {
          brand_id?: string
          confidence?: number | null
          created_at?: string
          data?: Json
          id?: string
          model?: string | null
          reviewed_by_user?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_dna_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_posts: {
        Row: {
          body: string
          brand_id: string
          campaign_id: string | null
          created_at: string
          cta_url: string | null
          id: string
          image_url: string | null
          is_published: boolean
          kind: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          brand_id: string
          campaign_id?: string | null
          created_at?: string
          cta_url?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          kind?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          brand_id?: string
          campaign_id?: string | null
          created_at?: string
          cta_url?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          kind?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_posts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_profiles: {
        Row: {
          about: string | null
          brand_name: string
          campaign_categories: string[]
          cover_url: string | null
          created_at: string
          id: string
          industry: string | null
          instagram: string | null
          is_public: boolean
          is_seed: boolean
          logo_url: string | null
          onboarding_completed: boolean
          updated_at: string
          user_id: string
          verification: Database["public"]["Enums"]["verification_status"]
          website: string | null
        }
        Insert: {
          about?: string | null
          brand_name?: string
          campaign_categories?: string[]
          cover_url?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          instagram?: string | null
          is_public?: boolean
          is_seed?: boolean
          logo_url?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
          verification?: Database["public"]["Enums"]["verification_status"]
          website?: string | null
        }
        Update: {
          about?: string | null
          brand_name?: string
          campaign_categories?: string[]
          cover_url?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          instagram?: string | null
          is_public?: boolean
          is_seed?: boolean
          logo_url?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
          verification?: Database["public"]["Enums"]["verification_status"]
          website?: string | null
        }
        Relationships: []
      }
      brand_subscriptions: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_subscriptions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_updates: {
        Row: {
          body: string
          brand_id: string
          categories: string[]
          compensation: string | null
          created_at: string
          creator_types: string[]
          cta_url: string | null
          id: string
          is_published: boolean
          is_seed: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          brand_id: string
          categories?: string[]
          compensation?: string | null
          created_at?: string
          creator_types?: string[]
          cta_url?: string | null
          id?: string
          is_published?: boolean
          is_seed?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          brand_id?: string
          categories?: string[]
          compensation?: string | null
          created_at?: string
          creator_types?: string[]
          cta_url?: string | null
          id?: string
          is_published?: boolean
          is_seed?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_updates_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_briefs: {
        Row: {
          campaign_id: string
          created_at: string
          data: Json
          edited_by_brand: boolean
          id: string
          model: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          data?: Json
          edited_by_brand?: boolean
          id?: string
          model?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          data?: Json
          edited_by_brand?: boolean
          id?: string
          model?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_briefs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brand_id: string
          budget_max: number | null
          budget_min: number | null
          compensation_type: Database["public"]["Enums"]["compensation_type"]
          created_at: string
          id: string
          is_seed: boolean
          published_at: string | null
          raw_prompt: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          title: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          budget_max?: number | null
          budget_min?: number | null
          compensation_type?: Database["public"]["Enums"]["compensation_type"]
          created_at?: string
          id?: string
          is_seed?: boolean
          published_at?: string | null
          raw_prompt?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          title?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          budget_max?: number | null
          budget_min?: number | null
          compensation_type?: Database["public"]["Enums"]["compensation_type"]
          created_at?: string
          id?: string
          is_seed?: boolean
          published_at?: string | null
          raw_prompt?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_submissions: {
        Row: {
          brand_feedback: string | null
          created_at: string
          creator_id: string
          deal_id: string
          id: string
          kind: string
          note: string | null
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          brand_feedback?: string | null
          created_at?: string
          creator_id: string
          deal_id: string
          id?: string
          kind?: string
          note?: string | null
          status?: string
          updated_at?: string
          url: string
        }
        Update: {
          brand_feedback?: string | null
          created_at?: string
          creator_id?: string
          deal_id?: string
          id?: string
          kind?: string
          note?: string | null
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_submissions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_submissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          id: string
          kind: string
          offer_id: string | null
          sender_id: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          kind?: string
          offer_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          kind?: string
          offer_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_reads: {
        Row: {
          conversation_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          brand_id: string | null
          campaign_id: string | null
          created_at: string
          creator_id: string | null
          deal_id: string | null
          id: string
          last_message_at: string
          party_a_user_id: string | null
          party_b_user_id: string | null
          requested_by: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          campaign_id?: string | null
          created_at?: string
          creator_id?: string | null
          deal_id?: string | null
          id?: string
          last_message_at?: string
          party_a_user_id?: string | null
          party_b_user_id?: string | null
          requested_by?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          campaign_id?: string | null
          created_at?: string
          creator_id?: string | null
          deal_id?: string | null
          id?: string
          last_message_at?: string
          party_a_user_id?: string | null
          party_b_user_id?: string | null
          requested_by?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_dna: {
        Row: {
          confidence: number | null
          created_at: string
          creator_id: string
          data: Json
          id: string
          model: string | null
          reviewed_by_user: boolean
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          creator_id: string
          data?: Json
          id?: string
          model?: string | null
          reviewed_by_user?: boolean
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          creator_id?: string
          data?: Json
          id?: string
          model?: string | null
          reviewed_by_user?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_dna_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          categories: string[]
          cover_url: string | null
          created_at: string
          creator_kind: string
          creator_types: string[]
          display_name: string
          headline: string | null
          id: string
          is_public: boolean
          is_seed: boolean
          languages: string[]
          location: string | null
          onboarding_completed: boolean
          open_to_barter: boolean
          open_to_paid: boolean
          portfolio_links: Json
          preferred_categories: string[]
          primary_category: string | null
          category_confidence: number | null
          category_source: string | null
          ai_category: string | null
          ai_category_locked: boolean
          starting_price_inr: number | null
          updated_at: string
          user_id: string
          verification: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          categories?: string[]
          cover_url?: string | null
          created_at?: string
          creator_kind?: string
          creator_types?: string[]
          display_name?: string
          headline?: string | null
          id?: string
          is_public?: boolean
          is_seed?: boolean
          languages?: string[]
          location?: string | null
          onboarding_completed?: boolean
          open_to_barter?: boolean
          open_to_paid?: boolean
          portfolio_links?: Json
          preferred_categories?: string[]
          primary_category?: string | null
          category_confidence?: number | null
          category_source?: string | null
          ai_category?: string | null
          ai_category_locked?: boolean
          starting_price_inr?: number | null
          updated_at?: string
          user_id: string
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          categories?: string[]
          cover_url?: string | null
          created_at?: string
          creator_kind?: string
          creator_types?: string[]
          display_name?: string
          headline?: string | null
          id?: string
          is_public?: boolean
          is_seed?: boolean
          languages?: string[]
          location?: string | null
          onboarding_completed?: boolean
          open_to_barter?: boolean
          open_to_paid?: boolean
          portfolio_links?: Json
          preferred_categories?: string[]
          primary_category?: string | null
          category_confidence?: number | null
          category_source?: string | null
          ai_category?: string | null
          ai_category_locked?: boolean
          starting_price_inr?: number | null
          updated_at?: string
          user_id?: string
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          user_id: string
          action: string
          window_start: string
          count: number
        }
        Insert: {
          user_id: string
          action: string
          window_start?: string
          count?: number
        }
        Update: {
          user_id?: string
          action?: string
          window_start?: string
          count?: number
        }
        Relationships: []
      }
      match_feedback: {
        Row: {
          id: string
          match_id: string
          brand_id: string
          creator_id: string
          action: string
          reason_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          brand_id: string
          creator_id: string
          action: string
          reason_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          match_id?: string
          brand_id?: string
          creator_id?: string
          action?: string
          reason_text?: string | null
          created_at?: string
        }
        Relationships: []
      }
      match_weights: {
        Row: {
          id: string
          brand_id: string
          category_weights: Json
          tone_weights: Json
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          category_weights?: Json
          tone_weights?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          category_weights?: Json
          tone_weights?: Json
          updated_at?: string
        }
        Relationships: []
      }
      weight_history: {
        Row: {
          id: string
          brand_id: string
          event_id: string | null
          weights_snapshot: Json
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          event_id?: string | null
          weights_snapshot: Json
          created_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          event_id?: string | null
          weights_snapshot?: Json
          created_at?: string
        }
        Relationships: []
      }
      deal_events: {
        Row: {
          actor_id: string | null
          created_at: string
          deal_id: string
          from_state: Database["public"]["Enums"]["deal_state"] | null
          id: string
          note: string | null
          to_state: Database["public"]["Enums"]["deal_state"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          deal_id: string
          from_state?: Database["public"]["Enums"]["deal_state"] | null
          id?: string
          note?: string | null
          to_state: Database["public"]["Enums"]["deal_state"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          deal_id?: string
          from_state?: Database["public"]["Enums"]["deal_state"] | null
          id?: string
          note?: string | null
          to_state?: Database["public"]["Enums"]["deal_state"]
        }
        Relationships: [
          {
            foreignKeyName: "deal_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          agreed_amount_inr: number | null
          barter_details: string | null
          brand_id: string
          campaign_id: string | null
          compensation_type: Database["public"]["Enums"]["compensation_type"]
          created_at: string
          creator_id: string
          id: string
          is_seed: boolean
          payment_secured: boolean
          state: Database["public"]["Enums"]["deal_state"]
          updated_at: string
        }
        Insert: {
          agreed_amount_inr?: number | null
          barter_details?: string | null
          brand_id: string
          campaign_id?: string | null
          compensation_type?: Database["public"]["Enums"]["compensation_type"]
          created_at?: string
          creator_id: string
          id?: string
          is_seed?: boolean
          payment_secured?: boolean
          state?: Database["public"]["Enums"]["deal_state"]
          updated_at?: string
        }
        Update: {
          agreed_amount_inr?: number | null
          barter_details?: string | null
          brand_id?: string
          campaign_id?: string | null
          compensation_type?: Database["public"]["Enums"]["compensation_type"]
          created_at?: string
          creator_id?: string
          id?: string
          is_seed?: boolean
          payment_secured?: boolean
          state?: Database["public"]["Enums"]["deal_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string
          deal_id: string | null
          details: string | null
          id: string
          raised_by: string
          reason: string
          resolution: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id?: string | null
          details?: string | null
          id?: string
          raised_by: string
          reason: string
          resolution?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string | null
          details?: string | null
          id?: string
          raised_by?: string
          reason?: string
          resolution?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_tags: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          owner_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          owner_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          owner_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          author_id: string
          author_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          deal_id: string
          decision: string | null
          id: string
          note: string | null
          overall: number | null
          ratings: Json
          reasons: string[]
        }
        Insert: {
          author_id: string
          author_role: Database["public"]["Enums"]["app_role"]
          created_at?: string
          deal_id: string
          decision?: string | null
          id?: string
          note?: string | null
          overall?: number | null
          ratings?: Json
          reasons?: string[]
        }
        Update: {
          author_id?: string
          author_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          deal_id?: string
          decision?: string | null
          id?: string
          note?: string | null
          overall?: number | null
          ratings?: Json
          reasons?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "feedback_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          campaign_id: string
          created_at: string
          creator_id: string
          creator_interested: boolean | null
          fit: Database["public"]["Enums"]["fit_label"]
          gaps: Json
          id: string
          invited: boolean
          reasons: Json
          score: number
          signals: Json
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          creator_id: string
          creator_interested?: boolean | null
          fit?: Database["public"]["Enums"]["fit_label"]
          gaps?: Json
          id?: string
          invited?: boolean
          reasons?: Json
          score?: number
          signals?: Json
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          creator_id?: string
          creator_interested?: boolean | null
          fit?: Database["public"]["Enums"]["fit_label"]
          gaps?: Json
          id?: string
          invited?: boolean
          reasons?: Json
          score?: number
          signals?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_preferences: {
        Row: {
          allow_brand_requests: boolean
          allow_creator_requests: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_brand_requests?: boolean
          allow_creator_requests?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_brand_requests?: boolean
          allow_creator_requests?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          created_at: string
          email_brand_posts: boolean
          email_deals: boolean
          email_messages: boolean
          email_offers: boolean
          email_payments: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_brand_posts?: boolean
          email_deals?: boolean
          email_messages?: boolean
          email_offers?: boolean
          email_payments?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_brand_posts?: boolean
          email_deals?: boolean
          email_messages?: boolean
          email_offers?: boolean
          email_payments?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          amount_inr: number | null
          author_role: Database["public"]["Enums"]["app_role"]
          compensation_type: Database["public"]["Enums"]["compensation_type"]
          conversation_id: string
          created_at: string
          created_by: string
          deliverables: string[]
          id: string
          notes: string | null
          parent_offer_id: string | null
          status: string
          timeline: string | null
          updated_at: string
        }
        Insert: {
          amount_inr?: number | null
          author_role: Database["public"]["Enums"]["app_role"]
          compensation_type?: Database["public"]["Enums"]["compensation_type"]
          conversation_id: string
          created_at?: string
          created_by: string
          deliverables?: string[]
          id?: string
          notes?: string | null
          parent_offer_id?: string | null
          status?: string
          timeline?: string | null
          updated_at?: string
        }
        Update: {
          amount_inr?: number | null
          author_role?: Database["public"]["Enums"]["app_role"]
          compensation_type?: Database["public"]["Enums"]["compensation_type"]
          conversation_id?: string
          created_at?: string
          created_by?: string
          deliverables?: string[]
          id?: string
          notes?: string | null
          parent_offer_id?: string | null
          status?: string
          timeline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_parent_offer_id_fkey"
            columns: ["parent_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          payment_id: string | null
          provider: string
          provider_event_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          payment_id?: string | null
          provider?: string
          provider_event_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          payment_id?: string | null
          provider?: string
          provider_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_inr: number
          created_at: string
          currency: string
          deal_id: string
          funded_at: string | null
          id: string
          method: string
          provider: string
          provider_payment_intent: string | null
          provider_session_id: string | null
          released_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_inr?: number
          created_at?: string
          currency?: string
          deal_id: string
          funded_at?: string | null
          id?: string
          method?: string
          provider?: string
          provider_payment_intent?: string | null
          provider_session_id?: string | null
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_inr?: number
          created_at?: string
          currency?: string
          deal_id?: string
          funded_at?: string | null
          id?: string
          method?: string
          provider?: string
          provider_payment_intent?: string | null
          provider_session_id?: string | null
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      pitches: {
        Row: {
          campaign_id: string
          created_at: string
          creator_id: string
          id: string
          message: string
          portfolio_url: string | null
          proposed_price_inr: number | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          creator_id: string
          id?: string
          message: string
          portfolio_url?: string | null
          proposed_price_inr?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          creator_id?: string
          id?: string
          message?: string
          portfolio_url?: string | null
          proposed_price_inr?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitches_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitches_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      shortlists: {
        Row: {
          campaign_id: string
          created_at: string
          creator_id: string
          id: string
          note: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          creator_id: string
          id?: string
          note?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          creator_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shortlists_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortlists_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          access_token_encrypted: string | null
          connected_via_oauth: boolean
          created_at: string
          engagement_rate: number | null
          external_id: string | null
          followers: number | null
          handle: string | null
          id: string
          last_synced_at: string | null
          platform: string
          profile_data: Json
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          connected_via_oauth?: boolean
          created_at?: string
          engagement_rate?: number | null
          external_id?: string | null
          followers?: number | null
          handle?: string | null
          id?: string
          last_synced_at?: string | null
          platform?: string
          profile_data?: Json
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          connected_via_oauth?: boolean
          created_at?: string
          engagement_rate?: number | null
          external_id?: string | null
          followers?: number | null
          handle?: string | null
          id?: string
          last_synced_at?: string | null
          platform?: string
          profile_data?: Json
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          body: string
          contact_email: string | null
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body: string
          contact_email?: string | null
          created_at?: string
          id?: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          contact_email?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_preset: boolean
          kind: string
          label: string
          related: string[]
          slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_preset?: boolean
          kind?: string
          label: string
          related?: string[]
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_preset?: boolean
          kind?: string
          label?: string
          related?: string[]
          slug?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
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
      verification_records: {
        Row: {
          created_at: string
          evidence: Json
          id: string
          reviewer_id: string | null
          reviewer_note: string | null
          status: Database["public"]["Enums"]["verification_status"]
          subject_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          evidence?: Json
          id?: string
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          subject_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          evidence?: Json
          id?: string
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          subject_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_match_feedback: {
        Args: {
          p_match_id: string
          p_brand_id: string
          p_creator_id: string
          p_action: string
          p_reason_text: string | null
          p_category_weights: Json
          p_tone_weights: Json
        }
        Returns: undefined
      }
      can_message_user: {
        Args: { _sender: string; _sender_role: string; _target: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_party: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_deal_party: {
        Args: { _deal_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "creator" | "brand" | "admin"
      campaign_status: "draft" | "published" | "closed"
      compensation_type: "paid" | "barter" | "hybrid"
      deal_state:
        | "DISCOVERED"
        | "NEGOTIATING"
        | "ACCEPTED"
        | "CREATING"
        | "REVIEW"
        | "COMPLETED"
        | "CANCELLED"
      fit_label: "strong" | "good" | "potential" | "weak"
      verification_status: "unverified" | "pending" | "approved" | "rejected"
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
      app_role: ["creator", "brand", "admin"],
      campaign_status: ["draft", "published", "closed"],
      compensation_type: ["paid", "barter", "hybrid"],
      deal_state: [
        "DISCOVERED",
        "NEGOTIATING",
        "ACCEPTED",
        "CREATING",
        "REVIEW",
        "COMPLETED",
        "CANCELLED",
      ],
      fit_label: ["strong", "good", "potential", "weak"],
      verification_status: ["unverified", "pending", "approved", "rejected"],
    },
  },
} as const
