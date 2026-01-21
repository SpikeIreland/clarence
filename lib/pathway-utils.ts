// ============================================================================
// CLARENCE CREATE PHASE - PATHWAY UTILITIES
// ============================================================================
// File: lib/pathway-utils.ts
// Purpose: Journey orchestration for the Create Phase
// Version: 1.0
// ============================================================================

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

/**
 * Status of an individual stage in the journey
 */
export type StageStatus =
    | 'pending'      // Not yet reached
    | 'active'       // Currently on this stage
    | 'completed'    // Finished
    | 'skipped'      // Bypassed (greyed in UI)
    | 'locked';      // Auto-completed, cannot be modified

/**
 * Whether a stage is required for a given pathway
 */
export type StageRequirement = 'required' | 'skipped' | 'conditional';

/**
 * Mediation type selected by the user
 */
export type MediationType = 'full_mediation' | 'partial_mediation' | 'straight_to_contract';

/**
 * How the contract will be sourced
 */
export type TemplateSource = 'existing_template' | 'modified_template' | 'uploaded' | 'from_scratch';

/**
 * All possible pathway IDs
 */
export type PathwayId =
    | 'FM-EXISTING' | 'FM-MODIFIED' | 'FM-UPLOADED' | 'FM-SCRATCH'
    | 'PM-EXISTING' | 'PM-MODIFIED' | 'PM-UPLOADED' | 'PM-SCRATCH'
    | 'STC-EXISTING' | 'STC-MODIFIED' | 'STC-UPLOADED' | 'STC-SCRATCH';

/**
 * All stage IDs in the journey
 */
export type StageId =
    | 'mediation_type'
    | 'contract_type'
    | 'quick_intake'
    | 'template_source'
    | 'template_selection'
    | 'document_upload'
    | 'pathway_review'
    | 'strategic_assessment'
    | 'contract_prep'
    | 'invite_providers'
    | 'contract_studio';

/**
 * Transition IDs between major stages
 */
export type TransitionId =
    | 'transition_to_assessment'
    | 'transition_to_prep'
    | 'transition_to_invite'
    | 'transition_to_studio';

/**
 * Timestamp tracking for a single stage
 */
export interface StageTimestamp {
    startedAt?: string;
    completedAt?: string;
    skippedAt?: string;
}

/**
 * Complete pathway state for a session
 * This is stored in the database as JSONB
 */
export interface PathwayState {
    // Current position in the journey
    currentStage: StageId;

    // Stages that have been completed
    completedStages: StageId[];

    // Stages that were skipped (based on pathway)
    skippedStages: StageId[];

    // Timestamps for audit trail
    stageTimestamps: {
        [key in StageId]?: StageTimestamp;
    };

    // Last transition shown (to avoid re-showing)
    lastTransitionShown?: TransitionId;

    // Metadata
    createdAt: string;
    updatedAt: string;
}

/**
 * Stage metadata for UI display
 */
export interface StageMetadata {
    id: StageId;
    label: string;
    shortLabel: string;
    description: string;
    page: string;
    group: ProgressGroup;
}

/**
 * Progress bar groupings (simplified view)
 */
export type ProgressGroup =
    | 'setup'     // Mediation Type + Contract Type
    | 'context'   // Quick Intake (Deal Context)
    | 'source'    // Template Source + Selection/Upload
    | 'review'    // Pathway Review
    | 'assess'    // Strategic Assessment
    | 'prep'      // Contract Preparation
    | 'invite';   // Invite Providers
// Note: Contract Studio is the destination, not a progress step

/**
 * Transition message configuration
 */
export interface TransitionConfig {
    id: TransitionId;
    fromStage: StageId;
    toStage: StageId;
    title: string;
    message: string;
    bulletPoints: string[];
    buttonText: string;
}

// ============================================================================
// SECTION 2: CONSTANTS - STAGE ORDER
// ============================================================================

/**
 * Ordered list of all stages in the journey
 */
export const STAGE_ORDER: StageId[] = [
    'mediation_type',
    'contract_type',
    'quick_intake',
    'template_source',
    'template_selection',
    'document_upload',
    'pathway_review',
    'strategic_assessment',
    'contract_prep',
    'invite_providers',
    'contract_studio',
];

/**
 * Stages that are part of the create-contract.tsx page
 */
export const CREATE_CONTRACT_STAGES: StageId[] = [
    'mediation_type',
    'contract_type',
    'quick_intake',
    'template_source',
    'template_selection',
    'document_upload',
    'pathway_review',
];

// ============================================================================
// SECTION 3: CONSTANTS - STAGE METADATA
// ============================================================================

export const STAGE_METADATA: Record<StageId, StageMetadata> = {
    mediation_type: {
        id: 'mediation_type',
        label: 'Mediation Type',
        shortLabel: 'Mediation',
        description: 'Choose your mediation approach',
        page: 'create-contract',
        group: 'setup',
    },
    contract_type: {
        id: 'contract_type',
        label: 'Contract Type',
        shortLabel: 'Type',
        description: 'Select the contract category',
        page: 'create-contract',
        group: 'setup',
    },
    quick_intake: {
        id: 'quick_intake',
        label: 'Deal Context',
        shortLabel: 'Context',
        description: 'Provide deal value, criticality, and timeline',
        page: 'create-contract',
        group: 'context',
    },
    template_source: {
        id: 'template_source',
        label: 'Template Source',
        shortLabel: 'Source',
        description: 'How will your contract be sourced?',
        page: 'create-contract',
        group: 'source',
    },
    template_selection: {
        id: 'template_selection',
        label: 'Template Selection',
        shortLabel: 'Template',
        description: 'Choose a specific template',
        page: 'create-contract',
        group: 'source',
    },
    document_upload: {
        id: 'document_upload',
        label: 'Document Upload',
        shortLabel: 'Upload',
        description: 'Upload your contract document',
        page: 'create-contract',
        group: 'source',
    },
    pathway_review: {
        id: 'pathway_review',
        label: 'Review & Create',
        shortLabel: 'Review',
        description: 'Review your selections and create the session',
        page: 'create-contract',
        group: 'review',
    },
    strategic_assessment: {
        id: 'strategic_assessment',
        label: 'Strategic Assessment',
        shortLabel: 'Assess',
        description: 'BATNA analysis, Party Fit, and Leverage calculation',
        page: 'strategic-assessment',
        group: 'assess',
    },
    contract_prep: {
        id: 'contract_prep',
        label: 'Contract Preparation',
        shortLabel: 'Prep',
        description: 'Configure clause positions and weights',
        page: 'contract-prep',
        group: 'prep',
    },
    invite_providers: {
        id: 'invite_providers',
        label: 'Invite Providers',
        shortLabel: 'Invite',
        description: 'Send invitations to providers',
        page: 'invite-provider',
        group: 'invite',
    },
    contract_studio: {
        id: 'contract_studio',
        label: 'Contract Studio',
        shortLabel: 'Studio',
        description: 'Live negotiation workspace',
        page: 'contract-studio',
        group: 'invite', // Grouped with invite for progress purposes
    },
};

// ============================================================================
// SECTION 4: CONSTANTS - PROGRESS GROUPS
// ============================================================================

export const PROGRESS_GROUPS: { id: ProgressGroup; label: string; stages: StageId[] }[] = [
    {
        id: 'setup',
        label: 'Setup',
        stages: ['mediation_type', 'contract_type'],
    },
    {
        id: 'context',
        label: 'Context',
        stages: ['quick_intake'],
    },
    {
        id: 'source',
        label: 'Source',
        stages: ['template_source', 'template_selection', 'document_upload'],
    },
    {
        id: 'review',
        label: 'Review',
        stages: ['pathway_review'],
    },
    {
        id: 'assess',
        label: 'Assess',
        stages: ['strategic_assessment'],
    },
    {
        id: 'prep',
        label: 'Prep',
        stages: ['contract_prep'],
    },
    {
        id: 'invite',
        label: 'Invite',
        stages: ['invite_providers'],
    },
];

// ============================================================================
// SECTION 5: CONSTANTS - PATHWAY CONFIGURATIONS
// ============================================================================

/**
 * Complete pathway configuration for all 12 pathways
 * Defines which stages are required, skipped, or conditional
 */
export const PATHWAY_STAGE_CONFIG: Record<PathwayId, Record<StageId, StageRequirement>> = {
    // -------------------------------------------------------------------------
    // Full Mediation Pathways
    // -------------------------------------------------------------------------
    'FM-EXISTING': {
        mediation_type: 'required',
        contract_type: 'required',
        quick_intake: 'required',
        template_source: 'required',
        template_selection: 'required',
        document_upload: 'skipped',
        pathway_review: 'required',
        strategic_assessment: 'required',
        contract_prep: 'required',
        invite_providers: 'required',
        contract_studio: 'required',
    },
    'FM-MODIFIED': {
        mediation_type: 'required',
        contract_type: 'required',
        quick_intake: 'required',
        template_source: 'required',
        template_selection: 'required',
        document_upload: 'skipped',
        pathway_review: 'required',
        strategic_assessment: 'required',
        contract_prep: 'required',
        invite_providers: 'required',
        contract_studio: 'required',
    },
    'FM-UPLOADED': {
        mediation_type: 'required',
        contract_type: 'required',
        quick_intake: 'required',
        template_source: 'required',
        template_selection: 'skipped',
        document_upload: 'required',
        pathway_review: 'required',
        strategic_assessment: 'required',
        contract_prep: 'required',
        invite_providers: 'required',
        contract_studio: 'required',
    },
    'FM-SCRATCH': {
        mediation_type: 'required',
        contract_type: 'required',
        quick_intake: 'required',
        template_source: 'required',
        template_selection: 'skipped',
        document_upload: 'skipped',
        pathway_review: 'required',
        strategic_assessment: 'required',
        contract_prep: 'required',
        invite_providers: 'required',
        contract_studio: 'required',
    },

    // -------------------------------------------------------------------------
    // Partial Mediation Pathways
    // -------------------------------------------------------------------------
    'PM-EXISTING': {
        mediation_type: 'required',
        contract_type: 'required',
        quick_intake: 'required',
        template_source: 'required',
        template_selection: 'required',
        document_upload: 'skipped',
        pathway_review: 'required',
        strategic_assessment: 'required',
        contract_prep: 'required',
        invite_providers: 'required',
        contract_studio: 'required',
    },
    'PM-MODIFIED': {
        mediation_type: 'required',
        contract_type: 'required',
        quick_intake: 'required',
        template_source: 'required',
        template_selection: 'required',
        document_upload: 'skipped',
        pathway_review: 'required',
        strategic_assessment: 'required',
        contract_prep: 'required',
        invite_providers: 'required',
        contract_studio: 'required',
    },
    'PM-UPLOADED': {
        mediation_type: 'required',
        contract_type: 'required',
        quick_intake: 'required',
        template_source: 'required',
        template_selection: 'skipped',
        document_upload: 'required',
        pathway_review: 'required',
        strategic_assessment: 'required',
        contract_prep: 'required',
        invite_providers: 'required',
        contract_studio: 'required',
    },
    'PM-SCRATCH': {
        mediation_type: 'required',
        contract_type: 'required',
        quick_intake: 'required',
        template_source: 'required',
        template_selection: 'skipped',
        document_upload: 'skipped',
        pathway_review: 'required',
        strategic_assessment: 'required',
        contract_prep: 'required',
        invite_providers: 'required',
        contract_studio: 'required',
    },

    // -------------------------------------------------------------------------
    // Straight to Contract Pathways
    // -------------------------------------------------------------------------
    'STC-EXISTING': {
        mediation_type: 'required',
        contract_type: 'required',
        quick_intake: 'skipped',
        template_source: 'required',
        template_selection: 'required',
        document_upload: 'skipped',
        pathway_review: 'required',
        strategic_assessment: 'skipped',
        contract_prep: 'skipped',           // True fast-track: skip entirely
        invite_providers: 'required',
        contract_studio: 'required',
    },
    'STC-MODIFIED': {
        mediation_type: 'required',
        contract_type: 'required',
        quick_intake: 'skipped',
        template_source: 'required',
        template_selection: 'required',
        document_upload: 'skipped',
        pathway_review: 'required',
        strategic_assessment: 'skipped',
        contract_prep: 'required',          // Still needed - positions may change
        invite_providers: 'required',
        contract_studio: 'required',
    },
    'STC-UPLOADED': {
        mediation_type: 'required',
        contract_type: 'required',
        quick_intake: 'skipped',
        template_source: 'required',
        template_selection: 'skipped',
        document_upload: 'required',
        pathway_review: 'required',
        strategic_assessment: 'skipped',
        contract_prep: 'required',          // Still needed - uploaded doc needs config
        invite_providers: 'required',
        contract_studio: 'required',
    },
    'STC-SCRATCH': {
        mediation_type: 'required',
        contract_type: 'required',
        quick_intake: 'skipped',
        template_source: 'required',
        template_selection: 'skipped',
        document_upload: 'skipped',
        pathway_review: 'required',
        strategic_assessment: 'skipped',
        contract_prep: 'required',          // Still needed - building from scratch
        invite_providers: 'required',
        contract_studio: 'required',
    },
};

// ============================================================================
// SECTION 6: CONSTANTS - TRANSITION MESSAGES
// ============================================================================

export const TRANSITION_CONFIGS: TransitionConfig[] = [
    {
        id: 'transition_to_assessment',
        fromStage: 'pathway_review',
        toStage: 'strategic_assessment',
        title: 'Contract Session Created',
        message: "Great! Your contract session is created. Before we begin negotiating, I need to understand your position better. The Strategic Assessment will help me:",
        bulletPoints: [
            'Evaluate your alternatives (BATNA Analysis)',
            'Assess compatibility with potential providers (Party Fit)',
            'Calculate your negotiating leverage',
        ],
        buttonText: 'Continue to Assessment',
    },
    {
        id: 'transition_to_prep',
        fromStage: 'strategic_assessment',
        toStage: 'contract_prep',
        title: 'Assessment Complete',
        message: "Excellent work on the assessment! Based on your inputs, I've calculated your initial leverage position. Now let's prepare your contract by:",
        bulletPoints: [
            'Reviewing the clauses that apply to your contract',
            'Setting your ideal position for each clause',
            'Weighting clauses by importance to you',
        ],
        buttonText: 'Continue to Contract Prep',
    },
    {
        id: 'transition_to_invite',
        fromStage: 'contract_prep',
        toStage: 'invite_providers',
        title: 'Positions Locked In',
        message: "Your contract positions are locked in. Now it's time to invite your provider(s) to the negotiation. They'll receive an email with a secure link to:",
        bulletPoints: [
            'Enter their company details',
            'Set their own clause positions',
            'Submit their negotiation parameters',
        ],
        buttonText: 'Continue to Invite',
    },
    {
        id: 'transition_to_studio',
        fromStage: 'invite_providers',
        toStage: 'contract_studio',
        title: 'Provider Ready',
        message: "Both parties are now ready. The Contract Studio will show:",
        bulletPoints: [
            'Side-by-side position comparison',
            'Real-time mediation suggestions from me',
            'Collaborative drafting tools',
        ],
        buttonText: 'Enter Contract Studio',
    },
];

// ============================================================================
// SECTION 7: HELPER FUNCTIONS - PATHWAY IDENTIFICATION
// ============================================================================

/**
 * Generate a pathway ID from mediation type and template source
 */
export function getPathwayId(mediationType: MediationType, templateSource: TemplateSource): PathwayId {
    const prefix: Record<MediationType, string> = {
        'full_mediation': 'FM',
        'partial_mediation': 'PM',
        'straight_to_contract': 'STC',
    };

    const suffix: Record<TemplateSource, string> = {
        'existing_template': 'EXISTING',
        'modified_template': 'MODIFIED',
        'uploaded': 'UPLOADED',
        'from_scratch': 'SCRATCH',
    };

    return `${prefix[mediationType]}-${suffix[templateSource]}` as PathwayId;
}

/**
 * Parse a pathway ID into its components
 */
export function parsePathwayId(pathwayId: PathwayId): { mediationType: MediationType; templateSource: TemplateSource } {
    const [prefix, suffix] = pathwayId.split('-');

    const mediationMap: Record<string, MediationType> = {
        'FM': 'full_mediation',
        'PM': 'partial_mediation',
        'STC': 'straight_to_contract',
    };

    const sourceMap: Record<string, TemplateSource> = {
        'EXISTING': 'existing_template',
        'MODIFIED': 'modified_template',
        'UPLOADED': 'uploaded',
        'SCRATCH': 'from_scratch',
    };

    return {
        mediationType: mediationMap[prefix],
        templateSource: sourceMap[suffix],
    };
}

/**
 * Check if a pathway is a "Straight to Contract" pathway
 */
export function isStraightToContract(pathwayId: PathwayId): boolean {
    return pathwayId.startsWith('STC-');
}

/**
 * Check if a pathway is the true fast-track (STC-EXISTING)
 */
export function isTrueFastTrack(pathwayId: PathwayId): boolean {
    return pathwayId === 'STC-EXISTING';
}

// ============================================================================
// SECTION 8: HELPER FUNCTIONS - STAGE QUERIES
// ============================================================================

/**
 * Check if a stage is required for a given pathway
 */
export function isStageRequired(pathwayId: PathwayId, stageId: StageId): boolean {
    return PATHWAY_STAGE_CONFIG[pathwayId]?.[stageId] === 'required';
}

/**
 * Check if a stage is skipped for a given pathway
 */
export function isStageSkipped(pathwayId: PathwayId, stageId: StageId): boolean {
    return PATHWAY_STAGE_CONFIG[pathwayId]?.[stageId] === 'skipped';
}

/**
 * Get all skipped stages for a pathway
 */
export function getSkippedStages(pathwayId: PathwayId): StageId[] {
    const config = PATHWAY_STAGE_CONFIG[pathwayId];
    return STAGE_ORDER.filter(stageId => config[stageId] === 'skipped');
}

/**
 * Get all required stages for a pathway (in order)
 */
export function getRequiredStages(pathwayId: PathwayId): StageId[] {
    const config = PATHWAY_STAGE_CONFIG[pathwayId];
    return STAGE_ORDER.filter(stageId => config[stageId] === 'required');
}

/**
 * Get the stage metadata
 */
export function getStageMetadata(stageId: StageId): StageMetadata {
    return STAGE_METADATA[stageId];
}

// ============================================================================
// SECTION 9: HELPER FUNCTIONS - NAVIGATION
// ============================================================================

/**
 * Get the next required stage after the current stage
 */
export function getNextStage(pathwayId: PathwayId, currentStage: StageId): StageId | null {
    const currentIndex = STAGE_ORDER.indexOf(currentStage);

    for (let i = currentIndex + 1; i < STAGE_ORDER.length; i++) {
        const nextStage = STAGE_ORDER[i];
        if (isStageRequired(pathwayId, nextStage)) {
            return nextStage;
        }
    }

    return null; // At the end
}

/**
 * Get the previous required stage before the current stage
 */
export function getPreviousStage(pathwayId: PathwayId, currentStage: StageId): StageId | null {
    const currentIndex = STAGE_ORDER.indexOf(currentStage);

    for (let i = currentIndex - 1; i >= 0; i--) {
        const prevStage = STAGE_ORDER[i];
        if (isStageRequired(pathwayId, prevStage)) {
            return prevStage;
        }
    }

    return null; // At the beginning
}

/**
 * Get the destination URL for the next stage
 */
export function getNextStageUrl(
    pathwayId: PathwayId,
    currentStage: StageId,
    sessionId: string,
    contractId?: string
): string {
    const nextStage = getNextStage(pathwayId, currentStage);

    if (!nextStage) {
        // Default to contract studio
        return buildUrl('/auth/contract-studio', { session_id: sessionId, contract_id: contractId, pathway_id: pathwayId });
    }

    return getStageUrl(nextStage, sessionId, contractId, pathwayId);
}

/**
 * Get the URL for a specific stage
 */
export function getStageUrl(
    stageId: StageId,
    sessionId: string,
    contractId?: string,
    pathwayId?: PathwayId
): string {
    const pageMap: Partial<Record<StageId, string>> = {
        'strategic_assessment': '/auth/strategic-assessment',
        'contract_prep': '/auth/contract-prep',
        'invite_providers': '/auth/invite-provider',
        'contract_studio': '/auth/contract-studio',
    };

    const basePath = pageMap[stageId];

    if (!basePath) {
        // Stages within create-contract page don't have their own URLs
        return `/auth/create-contract?session_id=${sessionId}`;
    }

    return buildUrl(basePath, { session_id: sessionId, contract_id: contractId, pathway_id: pathwayId });
}

/**
 * Build URL with query parameters
 */
function buildUrl(basePath: string, params: Record<string, string | undefined>): string {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value) {
            searchParams.set(key, value);
        }
    });

    const queryString = searchParams.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
}

// ============================================================================
// SECTION 10: HELPER FUNCTIONS - TRANSITIONS
// ============================================================================

/**
 * Get the transition config between two stages (if any)
 */
export function getTransitionConfig(fromStage: StageId, toStage: StageId): TransitionConfig | null {
    return TRANSITION_CONFIGS.find(t => t.fromStage === fromStage && t.toStage === toStage) || null;
}

/**
 * Check if a transition should be shown for a pathway
 */
export function shouldShowTransition(pathwayId: PathwayId, transitionId: TransitionId): boolean {
    const transition = TRANSITION_CONFIGS.find(t => t.id === transitionId);
    if (!transition) return false;

    // Check if both the from and to stages are required
    return isStageRequired(pathwayId, transition.fromStage) && isStageRequired(pathwayId, transition.toStage);
}

/**
 * Get the next transition after completing a stage
 */
export function getNextTransition(pathwayId: PathwayId, completedStage: StageId): TransitionConfig | null {
    const nextStage = getNextStage(pathwayId, completedStage);
    if (!nextStage) return null;

    const transition = getTransitionConfig(completedStage, nextStage);

    // Only return if the transition should be shown for this pathway
    if (transition && shouldShowTransition(pathwayId, transition.id)) {
        return transition;
    }

    return null;
}

// ============================================================================
// SECTION 11: HELPER FUNCTIONS - PATHWAY STATE MANAGEMENT
// ============================================================================

/**
 * Create initial pathway state for a new session
 */
export function createInitialPathwayState(pathwayId: PathwayId): PathwayState {
    const now = new Date().toISOString();
    const skippedStages = getSkippedStages(pathwayId);

    return {
        currentStage: 'mediation_type',
        completedStages: [],
        skippedStages,
        stageTimestamps: {
            mediation_type: { startedAt: now },
        },
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Update pathway state when completing a stage
 */
export function completeStage(state: PathwayState, stageId: StageId, pathwayId: PathwayId): PathwayState {
    const now = new Date().toISOString();
    const nextStage = getNextStage(pathwayId, stageId);

    const updatedTimestamps = {
        ...state.stageTimestamps,
        [stageId]: {
            ...state.stageTimestamps[stageId],
            completedAt: now,
        },
    };

    // Add startedAt for next stage if it exists
    if (nextStage) {
        updatedTimestamps[nextStage] = {
            ...updatedTimestamps[nextStage],
            startedAt: now,
        };
    }

    return {
        ...state,
        currentStage: nextStage || 'contract_studio',
        completedStages: [...state.completedStages, stageId],
        stageTimestamps: updatedTimestamps,
        updatedAt: now,
    };
}

/**
 * Mark a transition as shown
 */
export function markTransitionShown(state: PathwayState, transitionId: TransitionId): PathwayState {
    return {
        ...state,
        lastTransitionShown: transitionId,
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Get the status of a specific stage
 */
export function getStageStatus(state: PathwayState, stageId: StageId): StageStatus {
    if (state.skippedStages.includes(stageId)) {
        return 'skipped';
    }
    if (state.completedStages.includes(stageId)) {
        return 'completed';
    }
    if (state.currentStage === stageId) {
        return 'active';
    }
    return 'pending';
}

// ============================================================================
// SECTION 12: HELPER FUNCTIONS - PROGRESS CALCULATION
// ============================================================================

/**
 * Calculate overall progress percentage
 */
export function calculateProgress(pathwayId: PathwayId, state: PathwayState): number {
    const requiredStages = getRequiredStages(pathwayId);
    const completedCount = state.completedStages.filter(s => requiredStages.includes(s)).length;

    // Don't count contract_studio as it's the destination
    const totalStages = requiredStages.filter(s => s !== 'contract_studio').length;

    return Math.round((completedCount / totalStages) * 100);
}

/**
 * Get progress status for each group
 */
export function getGroupProgress(pathwayId: PathwayId, state: PathwayState): Record<ProgressGroup, 'completed' | 'active' | 'pending' | 'skipped'> {
    const result: Record<ProgressGroup, 'completed' | 'active' | 'pending' | 'skipped'> = {
        setup: 'pending',
        context: 'pending',
        source: 'pending',
        review: 'pending',
        assess: 'pending',
        prep: 'pending',
        invite: 'pending',
    };

    for (const group of PROGRESS_GROUPS) {
        const groupStages = group.stages;
        const requiredInGroup = groupStages.filter(s => isStageRequired(pathwayId, s));

        if (requiredInGroup.length === 0) {
            result[group.id] = 'skipped';
            continue;
        }

        const completedInGroup = requiredInGroup.filter(s => state.completedStages.includes(s));
        const activeInGroup = requiredInGroup.find(s => state.currentStage === s);

        if (completedInGroup.length === requiredInGroup.length) {
            result[group.id] = 'completed';
        } else if (activeInGroup) {
            result[group.id] = 'active';
        } else if (completedInGroup.length > 0) {
            result[group.id] = 'active'; // Partially complete
        }
    }

    return result;
}

// ============================================================================
// SECTION 13: EXPORTS
// ============================================================================

export default {
    // Types are exported above

    // Constants
    STAGE_ORDER,
    CREATE_CONTRACT_STAGES,
    STAGE_METADATA,
    PROGRESS_GROUPS,
    PATHWAY_STAGE_CONFIG,
    TRANSITION_CONFIGS,

    // Functions
    getPathwayId,
    parsePathwayId,
    isStraightToContract,
    isTrueFastTrack,
    isStageRequired,
    isStageSkipped,
    getSkippedStages,
    getRequiredStages,
    getStageMetadata,
    getNextStage,
    getPreviousStage,
    getNextStageUrl,
    getStageUrl,
    getTransitionConfig,
    shouldShowTransition,
    getNextTransition,
    createInitialPathwayState,
    completeStage,
    markTransitionShown,
    getStageStatus,
    calculateProgress,
    getGroupProgress,
};