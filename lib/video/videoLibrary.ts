// ============================================================================
// CLARENCE Video Library - Type Definitions
// ============================================================================
// File: /lib/video/videoLibrary.ts
// 
// NOTE: Video data is now stored in the database (training_videos table)
// and managed via Admin Panel → Videos tab.
//
// This file contains type definitions and constants only.
// All video data should be fetched using components from VideoPlayer.tsx
// ============================================================================

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

export interface TrainingVideo {
    video_id: string
    video_code: string
    youtube_id: string | null
    title: string
    description: string | null
    duration: string | null
    thumbnail_url: string | null
    category: VideoCategory
    placement: string[]
    priority: 'high' | 'medium' | 'low'
    status: 'placeholder' | 'scripted' | 'recorded' | 'published'
    script_notes: string | null
    is_active: boolean
    is_featured: boolean
    display_order: number
    created_at: string
    updated_at: string
    published_at: string | null
}

export type VideoCategory =
    | 'onboarding'
    | 'contract_creation'
    | 'contract_prep'
    | 'assessment'
    | 'provider'
    | 'negotiation'
    | 'document_centre'
    | 'training'

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

export const CATEGORY_LABELS: Record<VideoCategory, string> = {
    onboarding: 'Getting Started',
    contract_creation: 'Contract Creation',
    contract_prep: 'Contract Preparation',
    assessment: 'Strategic Assessment',
    provider: 'Provider Management',
    negotiation: 'Negotiation Studio',
    document_centre: 'Document Centre',
    training: 'Training Mode'
}

export const CATEGORY_ICONS: Record<VideoCategory, string> = {
    onboarding: '👋',
    contract_creation: '📝',
    contract_prep: '📋',
    assessment: '📊',
    provider: '🏢',
    negotiation: '⚖️',
    document_centre: '📁',
    training: '🎓'
}

export const VIDEO_PRIORITIES = {
    high: { label: 'High Priority', color: 'bg-red-100 text-red-700', sortOrder: 1 },
    medium: { label: 'Medium Priority', color: 'bg-blue-100 text-blue-700', sortOrder: 2 },
    low: { label: 'Low Priority', color: 'bg-slate-100 text-slate-600', sortOrder: 3 }
}

export const VIDEO_STATUSES = {
    placeholder: { label: 'Not Started', color: 'bg-slate-100 text-slate-600' },
    scripted: { label: 'Script Ready', color: 'bg-purple-100 text-purple-700' },
    recorded: { label: 'Recorded', color: 'bg-amber-100 text-amber-700' },
    published: { label: 'Published', color: 'bg-emerald-100 text-emerald-700' }
}

// ============================================================================
// SECTION 3: VIDEO CODES REFERENCE
// ============================================================================
// These are the video_code values stored in the database.
// Use these when calling <VideoPlayer videoCode="..." />
// ============================================================================

export const VIDEO_CODES = {
    // Onboarding
    WELCOME: 'onboarding-welcome',
    DASHBOARD: 'onboarding-dashboard',
    LIVE_VS_TRAINING: 'onboarding-live-vs-training',

    // Contract Creation
    MEDIATION_TYPE: 'creation-mediation-type',
    CONTRACT_TYPES: 'creation-contract-types',
    DEAL_CONTEXT: 'creation-deal-context',
    TEMPLATES: 'creation-templates',
    UPLOAD: 'creation-upload',

    // Contract Prep
    PREP_TOUR: 'prep-workspace-tour',
    CLAUSE_CATEGORIES: 'prep-clause-categories',
    POSITIONS: 'prep-positions',
    SAVE_TEMPLATE: 'prep-save-template',

    // Assessment
    ASSESSMENT_OVERVIEW: 'assessment-overview',
    LEVERAGE: 'assessment-leverage',
    DEAL_PROFILE: 'assessment-deal-profile',

    // Provider
    INVITE_PROVIDER: 'provider-invite',
    MULTI_PROVIDER: 'provider-multi',

    // Negotiation
    NEGOTIATION_TOUR: 'negotiation-tour',
    POSITION_LADDER: 'negotiation-position-ladder',
    MOVES: 'negotiation-moves',
    REALTIME_LEVERAGE: 'negotiation-leverage-realtime',
    CHAT: 'negotiation-chat',
    AGREEMENT: 'negotiation-agreement',
    DEALBREAKERS: 'negotiation-dealbreakers',

    // Document Centre
    DOCUMENTS_OVERVIEW: 'documents-overview',
    GENERATE_CONTRACT: 'documents-generate',

    // Training
    TRAINING_INTRO: 'training-intro',
    AI_OPPONENT: 'training-ai-opponent',
    TEACHING_MOMENTS: 'training-teaching-moments'
} as const

// Type for video codes
export type VideoCode = typeof VIDEO_CODES[keyof typeof VIDEO_CODES]