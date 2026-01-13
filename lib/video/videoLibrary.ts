// ============================================================================
// CLARENCE VIDEO LIBRARY
// ============================================================================
// This file contains all video placeholders for the CLARENCE platform.
// Videos are hosted on YouTube and embedded throughout the application.
//
// FOR JOHN: Each entry represents a video that needs to be created.
// - Keep videos under 90 seconds
// - Use consistent branding (CLARENCE green/amber for training)
// - Include captions for accessibility
// ============================================================================

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

export interface VideoMetadata {
    id: string                          // Unique identifier
    title: string                       // Display title
    description: string                 // Brief description for tooltips
    duration: string                    // Target duration (e.g., "60-90s")
    youtubeId: string | null            // YouTube video ID (null = placeholder)
    category: VideoCategory
    placement: string[]                 // Where this video appears in the app
    priority: 'high' | 'medium' | 'low' // Production priority
    status: 'placeholder' | 'scripted' | 'recorded' | 'published'
    scriptNotes?: string                // Notes for John on content
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

// ============================================================================
// SECTION 2: VIDEO LIBRARY
// ============================================================================

export const VIDEO_LIBRARY: VideoMetadata[] = [
    // -------------------------------------------------------------------------
    // ONBOARDING VIDEOS
    // -------------------------------------------------------------------------
    {
        id: 'onboarding-welcome',
        title: 'Welcome to CLARENCE: The Honest Broker',
        description: 'An introduction to CLARENCE and how AI-powered contract mediation works.',
        duration: '60-90s',
        youtubeId: null,
        category: 'onboarding',
        placement: ['dashboard-first-login', 'about-page', 'marketing-site'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: What is CLARENCE, the "Honest Broker" concept, benefits of AI mediation, brief platform overview. Warm, professional tone.'
    },
    {
        id: 'onboarding-dashboard',
        title: 'Your Dashboard Explained',
        description: 'Navigate your CLARENCE dashboard and understand your contract overview.',
        duration: '60-90s',
        youtubeId: null,
        category: 'onboarding',
        placement: ['dashboard-help', 'dashboard-first-visit'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: Live vs Training tabs, session cards, status indicators, quick actions, navigation to other areas.'
    },
    {
        id: 'onboarding-live-vs-training',
        title: 'Live vs Training Mode: Know the Difference',
        description: 'Understand when to use Live mode for real negotiations and Training mode for practice.',
        duration: '45-60s',
        youtubeId: null,
        category: 'onboarding',
        placement: ['dashboard-tabs', 'training-lobby'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: Visual differences (green vs amber), consequences (binding vs non-binding), when to use each, safety features of training mode.'
    },

    // -------------------------------------------------------------------------
    // CONTRACT CREATION VIDEOS
    // -------------------------------------------------------------------------
    {
        id: 'creation-mediation-type',
        title: 'Choosing Your Mediation Type',
        description: 'Learn the difference between Straight to Contract, Partial, and Full Mediation.',
        duration: '60-90s',
        youtubeId: null,
        category: 'contract_creation',
        placement: ['create-contract-mediation-step'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: Three types explained with examples. Straight = NDAs, standard terms. Partial = most terms fixed, key points negotiable. Full = everything negotiable. When to use each.'
    },
    {
        id: 'creation-contract-types',
        title: 'Contract Types Explained',
        description: 'Overview of the different contract types CLARENCE supports.',
        duration: '60-90s',
        youtubeId: null,
        category: 'contract_creation',
        placement: ['create-contract-type-step'],
        priority: 'medium',
        status: 'placeholder',
        scriptNotes: 'Cover: NDA, SaaS, BPO, MSA, Employment, Custom. Brief explanation of each, typical use cases, which templates are available.'
    },
    {
        id: 'creation-deal-context',
        title: 'Deal Context: Why It Matters',
        description: 'How providing deal context helps CLARENCE give better guidance.',
        duration: '60-90s',
        youtubeId: null,
        category: 'contract_creation',
        placement: ['create-contract-quick-intake'],
        priority: 'medium',
        status: 'placeholder',
        scriptNotes: 'Cover: Deal value affects risk tolerance, criticality affects leverage, timeline affects negotiation strategy, BATNA importance. How CLARENCE uses this context.'
    },
    {
        id: 'creation-templates',
        title: 'Starting from a Template',
        description: 'How to select and use contract templates to speed up your workflow.',
        duration: '60-90s',
        youtubeId: null,
        category: 'contract_creation',
        placement: ['create-contract-template-step'],
        priority: 'medium',
        status: 'placeholder',
        scriptNotes: 'Cover: What templates include, how to browse/filter, modifying vs using as-is, creating your own templates later.'
    },
    {
        id: 'creation-upload',
        title: 'Uploading Your Own Contract',
        description: 'How to upload existing contracts for CLARENCE to parse and analyse.',
        duration: '60-90s',
        youtubeId: null,
        category: 'contract_creation',
        placement: ['create-contract-upload-step'],
        priority: 'medium',
        status: 'placeholder',
        scriptNotes: 'Cover: Supported formats (PDF, DOCX), what happens during parsing, reviewing extracted clauses, handling parsing errors.'
    },

    // -------------------------------------------------------------------------
    // CONTRACT PREPARATION VIDEOS
    // -------------------------------------------------------------------------
    {
        id: 'prep-workspace-tour',
        title: 'Contract Prep: Your Workspace Tour',
        description: 'A guided tour of the Contract Preparation workspace.',
        duration: '90s',
        youtubeId: null,
        category: 'contract_prep',
        placement: ['contract-prep-first-visit'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: Three-panel layout, clause navigation, workspace area, CLARENCE chat. How the panels work together.'
    },
    {
        id: 'prep-clause-categories',
        title: 'Understanding Clause Categories',
        description: 'How clauses are organised and why categories matter for negotiation.',
        duration: '60-90s',
        youtubeId: null,
        category: 'contract_prep',
        placement: ['contract-prep-clause-panel'],
        priority: 'medium',
        status: 'placeholder',
        scriptNotes: 'Cover: Standard categories (Liability, Payment, IP, etc.), how categorisation affects leverage calculation, custom categories.'
    },
    {
        id: 'prep-positions',
        title: 'Setting Your Positions',
        description: 'How to set your ideal, acceptable, and floor positions for each clause.',
        duration: '60-90s',
        youtubeId: null,
        category: 'contract_prep',
        placement: ['contract-prep-position-slider'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: Position scale 1-10, what each position means, ideal vs floor, why gaps matter for negotiation room.'
    },
    {
        id: 'prep-save-template',
        title: 'Creating & Saving Templates',
        description: 'How to save your configured contract as a reusable template.',
        duration: '60-90s',
        youtubeId: null,
        category: 'contract_prep',
        placement: ['contract-prep-save-action'],
        priority: 'low',
        status: 'placeholder',
        scriptNotes: 'Cover: When to save as template, naming conventions, template library access, sharing with team (future).'
    },

    // -------------------------------------------------------------------------
    // STRATEGIC ASSESSMENT VIDEOS
    // -------------------------------------------------------------------------
    {
        id: 'assessment-overview',
        title: 'The Strategic Assessment: Overview',
        description: 'Understanding how CLARENCE assesses your negotiation position.',
        duration: '60-90s',
        youtubeId: null,
        category: 'assessment',
        placement: ['assessment-page-intro'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: What the assessment measures, how it informs strategy, when to revisit, connection to leverage calculation.'
    },
    {
        id: 'assessment-leverage',
        title: 'Understanding Leverage Scores',
        description: 'How leverage is calculated and what the scores mean.',
        duration: '60-90s',
        youtubeId: null,
        category: 'assessment',
        placement: ['assessment-results'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: Four factors (market, alternatives, criticality, urgency), how they combine, what high/low leverage means for strategy.'
    },
    {
        id: 'assessment-deal-profile',
        title: 'Deal Profile & Party Fit Explained',
        description: 'Understanding your deal profile and how well parties are matched.',
        duration: '60-90s',
        youtubeId: null,
        category: 'assessment',
        placement: ['assessment-page'],
        priority: 'medium',
        status: 'placeholder',
        scriptNotes: 'Cover: Deal value categories, party fit scoring, what good/poor fit means, how this affects negotiation approach.'
    },

    // -------------------------------------------------------------------------
    // PROVIDER MANAGEMENT VIDEOS
    // -------------------------------------------------------------------------
    {
        id: 'provider-invite',
        title: 'Inviting Providers to Negotiate',
        description: 'How to invite providers and manage the invitation process.',
        duration: '60-90s',
        youtubeId: null,
        category: 'provider',
        placement: ['provider-invite-modal'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: Email invitation process, what providers see, tracking invitation status, resending invites.'
    },
    {
        id: 'provider-multi',
        title: 'Multi-Provider Negotiations',
        description: 'How to negotiate with multiple providers simultaneously.',
        duration: '60-90s',
        youtubeId: null,
        category: 'provider',
        placement: ['session-multi-provider'],
        priority: 'medium',
        status: 'placeholder',
        scriptNotes: 'Cover: Why use multiple providers, how data is isolated, comparing positions across providers, making decisions.'
    },

    // -------------------------------------------------------------------------
    // NEGOTIATION STUDIO VIDEOS
    // -------------------------------------------------------------------------
    {
        id: 'negotiation-tour',
        title: 'Negotiation Studio: Your Workspace Tour',
        description: 'A guided tour of the live negotiation interface.',
        duration: '90s',
        youtubeId: null,
        category: 'negotiation',
        placement: ['contract-studio-first-visit'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: Three-panel layout in negotiation context, clause list, position workspace, CLARENCE guidance panel, status indicators.'
    },
    {
        id: 'negotiation-position-ladder',
        title: 'The Position Ladder Explained',
        description: 'Understanding the visual position ladder and what each rung means.',
        duration: '60-90s',
        youtubeId: null,
        category: 'negotiation',
        placement: ['position-component'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: 1-10 scale visual, customer vs provider positions, gap visualization, movement indicators, floor/ceiling concepts.'
    },
    {
        id: 'negotiation-moves',
        title: 'Making & Responding to Moves',
        description: 'How to make position changes and respond to counterparty moves.',
        duration: '60-90s',
        youtubeId: null,
        category: 'negotiation',
        placement: ['during-negotiation'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: Proposing a new position, reviewing counterparty moves, accept/counter/reject options, strategic timing.'
    },
    {
        id: 'negotiation-leverage-realtime',
        title: 'Understanding Leverage in Real-Time',
        description: 'How leverage changes during negotiation and how to use it.',
        duration: '60-90s',
        youtubeId: null,
        category: 'negotiation',
        placement: ['leverage-panel'],
        priority: 'medium',
        status: 'placeholder',
        scriptNotes: 'Cover: Live leverage updates, what shifts leverage, using leverage info strategically, CLARENCE suggestions based on leverage.'
    },
    {
        id: 'negotiation-chat',
        title: 'Using Party Chat',
        description: 'How to communicate with the other party during negotiation.',
        duration: '45-60s',
        youtubeId: null,
        category: 'negotiation',
        placement: ['chat-panel'],
        priority: 'medium',
        status: 'placeholder',
        scriptNotes: 'Cover: When to use chat, keeping communication professional, chat vs position moves, message history.'
    },
    {
        id: 'negotiation-agreement',
        title: 'Reaching Agreement on a Clause',
        description: 'What happens when both parties agree on a clause position.',
        duration: '60-90s',
        youtubeId: null,
        category: 'negotiation',
        placement: ['agreement-flow'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: Agreement indicators, locked clauses, progress tracking, what happens next, undoing agreements (if applicable).'
    },
    {
        id: 'negotiation-dealbreakers',
        title: 'Deal Breakers & Red Lines',
        description: 'How to set and communicate non-negotiable positions.',
        duration: '60-90s',
        youtubeId: null,
        category: 'negotiation',
        placement: ['dealbreaker-toggle'],
        priority: 'medium',
        status: 'placeholder',
        scriptNotes: 'Cover: What is a deal breaker, when to use them, how other party sees them, strategic use vs overuse.'
    },

    // -------------------------------------------------------------------------
    // DOCUMENT CENTRE VIDEOS
    // -------------------------------------------------------------------------
    {
        id: 'documents-overview',
        title: 'Document Centre: Managing Your Contracts',
        description: 'Overview of the Document Centre and contract management features.',
        duration: '60-90s',
        youtubeId: null,
        category: 'document_centre',
        placement: ['document-centre-page'],
        priority: 'medium',
        status: 'placeholder',
        scriptNotes: 'Cover: Document library, status tracking, version history, searching and filtering, archive vs active.'
    },
    {
        id: 'documents-generate',
        title: 'Generating Your Final Contract',
        description: 'How to generate the final contract document after negotiation.',
        duration: '60-90s',
        youtubeId: null,
        category: 'document_centre',
        placement: ['export-action'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: When contract is ready to generate, format options, what is included, downloading and sharing, next steps.'
    },

    // -------------------------------------------------------------------------
    // TRAINING MODE VIDEOS
    // -------------------------------------------------------------------------
    {
        id: 'training-intro',
        title: 'Training Mode: Practice Without Risk',
        description: 'Introduction to Training Mode and its benefits.',
        duration: '60-90s',
        youtubeId: null,
        category: 'training',
        placement: ['training-lobby'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: What training mode is, amber visual indicators, no real consequences, perfect for learning, scenarios vs custom.'
    },
    {
        id: 'training-ai-opponent',
        title: 'Negotiating Against CLARENCE AI',
        description: 'How the AI counterparty works in training mode.',
        duration: '60-90s',
        youtubeId: null,
        category: 'training',
        placement: ['training-session-start'],
        priority: 'high',
        status: 'placeholder',
        scriptNotes: 'Cover: Three AI modes (cooperative/balanced/aggressive), how AI makes decisions, learning from AI feedback, adjusting difficulty.'
    },
    {
        id: 'training-teaching-moments',
        title: 'Understanding Teaching Moments',
        description: 'How CLARENCE provides feedback and tips during training.',
        duration: '45-60s',
        youtubeId: null,
        category: 'training',
        placement: ['training-session'],
        priority: 'medium',
        status: 'placeholder',
        scriptNotes: 'Cover: When teaching moments appear, types of feedback (tips, celebrations, warnings), learning from suggestions.'
    }
]

// ============================================================================
// SECTION 3: HELPER FUNCTIONS
// ============================================================================

/**
 * Get all videos in a specific category
 */
export function getVideosByCategory(category: VideoCategory): VideoMetadata[] {
    return VIDEO_LIBRARY.filter(v => v.category === category)
}

/**
 * Get a specific video by ID
 */
export function getVideoById(id: string): VideoMetadata | undefined {
    return VIDEO_LIBRARY.find(v => v.id === id)
}

/**
 * Get videos for a specific placement location
 */
export function getVideosForPlacement(placement: string): VideoMetadata[] {
    return VIDEO_LIBRARY.filter(v => v.placement.includes(placement))
}

/**
 * Get all videos that need to be created (no YouTube ID yet)
 */
export function getPlaceholderVideos(): VideoMetadata[] {
    return VIDEO_LIBRARY.filter(v => v.youtubeId === null)
}

/**
 * Get videos by priority
 */
export function getVideosByPriority(priority: 'high' | 'medium' | 'low'): VideoMetadata[] {
    return VIDEO_LIBRARY.filter(v => v.priority === priority)
}

/**
 * Get video statistics
 */
export function getVideoStats() {
    const total = VIDEO_LIBRARY.length
    const published = VIDEO_LIBRARY.filter(v => v.status === 'published').length
    const placeholder = VIDEO_LIBRARY.filter(v => v.status === 'placeholder').length
    const byCategory = Object.keys(CATEGORY_LABELS).map(cat => ({
        category: cat as VideoCategory,
        label: CATEGORY_LABELS[cat as VideoCategory],
        count: VIDEO_LIBRARY.filter(v => v.category === cat).length
    }))
    const byPriority = {
        high: VIDEO_LIBRARY.filter(v => v.priority === 'high').length,
        medium: VIDEO_LIBRARY.filter(v => v.priority === 'medium').length,
        low: VIDEO_LIBRARY.filter(v => v.priority === 'low').length
    }

    return { total, published, placeholder, byCategory, byPriority }
}