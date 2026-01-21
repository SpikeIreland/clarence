// ============================================================================
// CLARENCE Create Stage - Pathway Configuration
// ============================================================================
// File: /lib/config/create-pathways.ts
// Purpose: Define all valid pathways through the Create stage
// This creates a "single source of truth" for flow logic
// ============================================================================

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

export type MediationType = 'straight_to_contract' | 'partial_mediation' | 'full_mediation'
export type ContractType = 'nda' | 'saas' | 'bpo' | 'msa' | 'employment' | 'custom'
export type TemplateSource = 'existing_template' | 'modified_template' | 'uploaded' | 'from_scratch'

export interface PathwayConfig {
    id: string
    name: string
    description: string

    // What triggers this pathway
    conditions: {
        mediationType: MediationType
        templateSource: TemplateSource
        // Contract type doesn't affect flow, just content
    }

    // What steps are required
    requiredSteps: PathwayStep[]

    // Where does this pathway end?
    destination: 'contract_studio' | 'invite_provider' | 'contract_prep'

    // Does this pathway require a session before proceeding?
    requiresSessionFirst: boolean

    // Does this pathway need clause verification?
    requiresClauseVerification: boolean

    // Does this pathway need strategic assessment?
    requiresStrategicAssessment: boolean

    // Special behaviors
    behaviors: {
        skipQuickIntake?: boolean
        autoLockClauses?: boolean
        skipProviderInvite?: boolean
    }
}

export type PathwayStep =
    | 'mediation_type'
    | 'contract_type'
    | 'quick_intake'
    | 'template_source'
    | 'template_selection'
    | 'upload_processing'
    | 'clause_verification'    // In contract-prep
    | 'strategic_assessment'   // In strategic-assessment page
    | 'provider_invite'        // In invite-provider page
    | 'summary'
    | 'creating'

// ============================================================================
// SECTION 2: PATHWAY REGISTRY
// ============================================================================

export const CREATE_PATHWAYS: PathwayConfig[] = [
    // ========================================================================
    // STRAIGHT TO CONTRACT PATHWAYS (Minimal/No Negotiation)
    // ========================================================================

    {
        id: 'STC-EXISTING',
        name: 'Straight to Contract - Existing Template',
        description: 'Use a standard template with no negotiation. Fastest path.',
        conditions: {
            mediationType: 'straight_to_contract',
            templateSource: 'existing_template'
        },
        requiredSteps: [
            'mediation_type',
            'contract_type',
            'template_source',
            'template_selection',
            'summary',
            'creating'
        ],
        destination: 'invite_provider',  // Go straight to invite, skip contract-prep
        requiresSessionFirst: true,
        requiresClauseVerification: false,  // Clauses are pre-verified in template
        requiresStrategicAssessment: false,
        behaviors: {
            skipQuickIntake: true,
            autoLockClauses: true,
            skipProviderInvite: false
        }
    },

    {
        id: 'STC-UPLOADED',
        name: 'Straight to Contract - Uploaded Contract',
        description: 'Upload your own contract, use it as-is with no negotiation.',
        conditions: {
            mediationType: 'straight_to_contract',
            templateSource: 'uploaded'
        },
        requiredSteps: [
            'mediation_type',
            'contract_type',
            'template_source',
            'upload_processing',
            'clause_verification',  // ⚠️ KEY: Must verify uploaded clauses even in STC
            'summary',
            'creating'
        ],
        destination: 'contract_prep',  // Must go through contract-prep to verify clauses
        requiresSessionFirst: true,    // ⚠️ KEY FIX: Create session BEFORE going to contract-prep
        requiresClauseVerification: true,
        requiresStrategicAssessment: false,
        behaviors: {
            skipQuickIntake: true,
            autoLockClauses: true,  // After verification, lock all clauses
            skipProviderInvite: false
        }
    },

    {
        id: 'STC-MODIFIED',
        name: 'Straight to Contract - Modified Template',
        description: 'Start with a template, make minor edits, no negotiation.',
        conditions: {
            mediationType: 'straight_to_contract',
            templateSource: 'modified_template'
        },
        requiredSteps: [
            'mediation_type',
            'contract_type',
            'template_source',
            'template_selection',
            'clause_verification',  // Allow edits in contract-prep
            'summary',
            'creating'
        ],
        destination: 'contract_prep',
        requiresSessionFirst: true,
        requiresClauseVerification: true,
        requiresStrategicAssessment: false,
        behaviors: {
            skipQuickIntake: true,
            autoLockClauses: true,
            skipProviderInvite: false
        }
    },

    {
        id: 'STC-SCRATCH',
        name: 'Straight to Contract - From Scratch',
        description: 'Build contract clause-by-clause, no negotiation.',
        conditions: {
            mediationType: 'straight_to_contract',
            templateSource: 'from_scratch'
        },
        requiredSteps: [
            'mediation_type',
            'contract_type',
            'template_source',
            'clause_verification',  // Build clauses in contract-prep
            'summary',
            'creating'
        ],
        destination: 'contract_prep',
        requiresSessionFirst: true,
        requiresClauseVerification: true,
        requiresStrategicAssessment: false,
        behaviors: {
            skipQuickIntake: true,
            autoLockClauses: true,
            skipProviderInvite: false
        }
    },

    // ========================================================================
    // PARTIAL MEDIATION PATHWAYS (85% Locked, Key Clauses Negotiable)
    // ========================================================================

    {
        id: 'PM-EXISTING',
        name: 'Partial Mediation - Existing Template',
        description: 'Most clauses locked, select key clauses for negotiation.',
        conditions: {
            mediationType: 'partial_mediation',
            templateSource: 'existing_template'
        },
        requiredSteps: [
            'mediation_type',
            'contract_type',
            'quick_intake',
            'template_source',
            'template_selection',
            'clause_verification',   // Mark which clauses are negotiable
            'strategic_assessment',
            'summary',
            'creating'
        ],
        destination: 'contract_prep',
        requiresSessionFirst: true,
        requiresClauseVerification: true,
        requiresStrategicAssessment: true,
        behaviors: {
            skipQuickIntake: false,
            autoLockClauses: false,  // User chooses which to lock
            skipProviderInvite: false
        }
    },

    {
        id: 'PM-UPLOADED',
        name: 'Partial Mediation - Uploaded Contract',
        description: 'Upload contract, select key clauses for negotiation.',
        conditions: {
            mediationType: 'partial_mediation',
            templateSource: 'uploaded'
        },
        requiredSteps: [
            'mediation_type',
            'contract_type',
            'quick_intake',
            'template_source',
            'upload_processing',
            'clause_verification',
            'strategic_assessment',
            'summary',
            'creating'
        ],
        destination: 'contract_prep',
        requiresSessionFirst: true,
        requiresClauseVerification: true,
        requiresStrategicAssessment: true,
        behaviors: {
            skipQuickIntake: false,
            autoLockClauses: false,
            skipProviderInvite: false
        }
    },

    {
        id: 'PM-MODIFIED',
        name: 'Partial Mediation - Modified Template',
        description: 'Customize template, select key clauses for negotiation.',
        conditions: {
            mediationType: 'partial_mediation',
            templateSource: 'modified_template'
        },
        requiredSteps: [
            'mediation_type',
            'contract_type',
            'quick_intake',
            'template_source',
            'template_selection',
            'clause_verification',
            'strategic_assessment',
            'summary',
            'creating'
        ],
        destination: 'contract_prep',
        requiresSessionFirst: true,
        requiresClauseVerification: true,
        requiresStrategicAssessment: true,
        behaviors: {
            skipQuickIntake: false,
            autoLockClauses: false,
            skipProviderInvite: false
        }
    },

    {
        id: 'PM-SCRATCH',
        name: 'Partial Mediation - From Scratch',
        description: 'Build contract, select key clauses for negotiation.',
        conditions: {
            mediationType: 'partial_mediation',
            templateSource: 'from_scratch'
        },
        requiredSteps: [
            'mediation_type',
            'contract_type',
            'quick_intake',
            'template_source',
            'clause_verification',
            'strategic_assessment',
            'summary',
            'creating'
        ],
        destination: 'contract_prep',
        requiresSessionFirst: true,
        requiresClauseVerification: true,
        requiresStrategicAssessment: true,
        behaviors: {
            skipQuickIntake: false,
            autoLockClauses: false,
            skipProviderInvite: false
        }
    },

    // ========================================================================
    // FULL MEDIATION PATHWAYS (All Clauses Negotiable)
    // ========================================================================

    {
        id: 'FM-EXISTING',
        name: 'Full Mediation - Existing Template',
        description: 'All clauses open for negotiation.',
        conditions: {
            mediationType: 'full_mediation',
            templateSource: 'existing_template'
        },
        requiredSteps: [
            'mediation_type',
            'contract_type',
            'quick_intake',
            'template_source',
            'template_selection',
            'clause_verification',
            'strategic_assessment',
            'summary',
            'creating'
        ],
        destination: 'contract_prep',
        requiresSessionFirst: true,
        requiresClauseVerification: true,
        requiresStrategicAssessment: true,
        behaviors: {
            skipQuickIntake: false,
            autoLockClauses: false,
            skipProviderInvite: false
        }
    },

    {
        id: 'FM-UPLOADED',
        name: 'Full Mediation - Uploaded Contract',
        description: 'Upload contract, all clauses negotiable.',
        conditions: {
            mediationType: 'full_mediation',
            templateSource: 'uploaded'
        },
        requiredSteps: [
            'mediation_type',
            'contract_type',
            'quick_intake',
            'template_source',
            'upload_processing',
            'clause_verification',
            'strategic_assessment',
            'summary',
            'creating'
        ],
        destination: 'contract_prep',
        requiresSessionFirst: true,
        requiresClauseVerification: true,
        requiresStrategicAssessment: true,
        behaviors: {
            skipQuickIntake: false,
            autoLockClauses: false,
            skipProviderInvite: false
        }
    },

    {
        id: 'FM-MODIFIED',
        name: 'Full Mediation - Modified Template',
        description: 'Customize template, all clauses negotiable.',
        conditions: {
            mediationType: 'full_mediation',
            templateSource: 'modified_template'
        },
        requiredSteps: [
            'mediation_type',
            'contract_type',
            'quick_intake',
            'template_source',
            'template_selection',
            'clause_verification',
            'strategic_assessment',
            'summary',
            'creating'
        ],
        destination: 'contract_prep',
        requiresSessionFirst: true,
        requiresClauseVerification: true,
        requiresStrategicAssessment: true,
        behaviors: {
            skipQuickIntake: false,
            autoLockClauses: false,
            skipProviderInvite: false
        }
    },

    {
        id: 'FM-SCRATCH',
        name: 'Full Mediation - From Scratch',
        description: 'Build contract from scratch, all clauses negotiable.',
        conditions: {
            mediationType: 'full_mediation',
            templateSource: 'from_scratch'
        },
        requiredSteps: [
            'mediation_type',
            'contract_type',
            'quick_intake',
            'template_source',
            'clause_verification',
            'strategic_assessment',
            'summary',
            'creating'
        ],
        destination: 'contract_prep',
        requiresSessionFirst: true,
        requiresClauseVerification: true,
        requiresStrategicAssessment: true,
        behaviors: {
            skipQuickIntake: false,
            autoLockClauses: false,
            skipProviderInvite: false
        }
    }
]

// ============================================================================
// SECTION 3: UTILITY FUNCTIONS
// ============================================================================

/**
 * Find the pathway configuration based on user selections
 */
export function getPathway(
    mediationType: MediationType,
    templateSource: TemplateSource
): PathwayConfig | null {
    return CREATE_PATHWAYS.find(p =>
        p.conditions.mediationType === mediationType &&
        p.conditions.templateSource === templateSource
    ) || null
}

/**
 * Get the next step in a pathway given current step
 */
export function getNextStep(
    pathway: PathwayConfig,
    currentStep: PathwayStep
): PathwayStep | null {
    const currentIndex = pathway.requiredSteps.indexOf(currentStep)
    if (currentIndex === -1 || currentIndex === pathway.requiredSteps.length - 1) {
        return null
    }
    return pathway.requiredSteps[currentIndex + 1]
}

/**
 * Get the previous step in a pathway given current step
 */
export function getPreviousStep(
    pathway: PathwayConfig,
    currentStep: PathwayStep
): PathwayStep | null {
    const currentIndex = pathway.requiredSteps.indexOf(currentStep)
    if (currentIndex <= 0) {
        return null
    }
    return pathway.requiredSteps[currentIndex - 1]
}

/**
 * Check if a step is required for a given pathway
 */
export function isStepRequired(
    pathway: PathwayConfig,
    step: PathwayStep
): boolean {
    return pathway.requiredSteps.includes(step)
}

/**
 * Get progress percentage through the pathway
 */
export function getProgressPercentage(
    pathway: PathwayConfig,
    currentStep: PathwayStep
): number {
    const currentIndex = pathway.requiredSteps.indexOf(currentStep)
    if (currentIndex === -1) return 0
    return Math.round(((currentIndex + 1) / pathway.requiredSteps.length) * 100)
}

/**
 * Get human-readable step label
 */
export function getStepLabel(step: PathwayStep): string {
    const labels: Record<PathwayStep, string> = {
        'mediation_type': 'Mediation Type',
        'contract_type': 'Contract Type',
        'quick_intake': 'Deal Context',
        'template_source': 'Template Source',
        'template_selection': 'Select Template',
        'upload_processing': 'Upload Contract',
        'clause_verification': 'Verify Clauses',
        'strategic_assessment': 'Strategic Assessment',
        'provider_invite': 'Invite Provider',
        'summary': 'Review & Confirm',
        'creating': 'Creating...'
    }
    return labels[step] || step
}

/**
 * Build the redirect URL based on pathway and current state
 */
export function buildRedirectUrl(
    pathway: PathwayConfig,
    sessionId: string,
    contractId?: string
): string {
    const params = new URLSearchParams()
    params.set('session_id', sessionId)
    params.set('pathway_id', pathway.id)

    if (contractId) {
        params.set('contract_id', contractId)
    }

    // Determine destination based on pathway
    switch (pathway.destination) {
        case 'contract_prep':
            return `/auth/contract-prep?${params.toString()}`
        case 'invite_provider':
            return `/auth/invite-provider?${params.toString()}`
        case 'contract_studio':
            return `/auth/contract-studio?${params.toString()}`
        default:
            return `/auth/contract-prep?${params.toString()}`
    }
}

// ============================================================================
// SECTION 4: VALIDATION HELPERS
// ============================================================================

/**
 * Validate that a pathway transition is allowed
 */
export function validateTransition(
    pathway: PathwayConfig,
    fromStep: PathwayStep,
    toStep: PathwayStep
): { valid: boolean; reason?: string } {
    const fromIndex = pathway.requiredSteps.indexOf(fromStep)
    const toIndex = pathway.requiredSteps.indexOf(toStep)

    if (fromIndex === -1) {
        return { valid: false, reason: `Step '${fromStep}' is not part of this pathway` }
    }

    if (toIndex === -1) {
        return { valid: false, reason: `Step '${toStep}' is not part of this pathway` }
    }

    // Allow forward movement (skip is OK) or going back one step
    if (toIndex > fromIndex || toIndex === fromIndex - 1) {
        return { valid: true }
    }

    return { valid: false, reason: 'Cannot skip backwards more than one step' }
}

/**
 * Check if all prerequisites for a step are met
 */
export function checkPrerequisites(
    pathway: PathwayConfig,
    targetStep: PathwayStep,
    completedSteps: PathwayStep[]
): { ready: boolean; missingSteps: PathwayStep[] } {
    const targetIndex = pathway.requiredSteps.indexOf(targetStep)
    if (targetIndex === -1) {
        return { ready: false, missingSteps: [] }
    }

    const prerequisiteSteps = pathway.requiredSteps.slice(0, targetIndex)
    const missingSteps = prerequisiteSteps.filter(step => !completedSteps.includes(step))

    return {
        ready: missingSteps.length === 0,
        missingSteps
    }
}

// ============================================================================
// SECTION 5: EXPORT SUMMARY FOR DOCUMENTATION
// ============================================================================

export function generatePathwaySummary(): string {
    let summary = '# CLARENCE Create Stage - Pathway Summary\n\n'

    const groupedByMediation = {
        straight_to_contract: CREATE_PATHWAYS.filter(p => p.conditions.mediationType === 'straight_to_contract'),
        partial_mediation: CREATE_PATHWAYS.filter(p => p.conditions.mediationType === 'partial_mediation'),
        full_mediation: CREATE_PATHWAYS.filter(p => p.conditions.mediationType === 'full_mediation')
    }

    for (const [mediation, pathways] of Object.entries(groupedByMediation)) {
        summary += `## ${mediation.replace(/_/g, ' ').toUpperCase()}\n\n`

        for (const pathway of pathways) {
            summary += `### ${pathway.id}: ${pathway.name}\n`
            summary += `${pathway.description}\n\n`
            summary += `**Steps:** ${pathway.requiredSteps.map(getStepLabel).join(' → ')}\n\n`
            summary += `**Destination:** ${pathway.destination}\n`
            summary += `**Requires Session First:** ${pathway.requiresSessionFirst ? 'Yes' : 'No'}\n`
            summary += `**Requires Clause Verification:** ${pathway.requiresClauseVerification ? 'Yes' : 'No'}\n`
            summary += `**Requires Strategic Assessment:** ${pathway.requiresStrategicAssessment ? 'Yes' : 'No'}\n\n`
        }
    }

    return summary
}