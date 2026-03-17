// ============================================================================
// FILE: lib/schedule-types.ts
// PURPOSE: Schedule type definitions for contract schedule detection & review
// DEPLOY TO: /lib/schedule-types.ts
// ============================================================================
// This file provides:
// 1. Schedule type definitions with labels, descriptions, and icons
// 2. Mappings of which contract types expect/require each schedule
// 3. Helper functions for schedule type lookups
// ============================================================================


// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

export interface ScheduleTypeDefinition {
    scheduleType: string
    scheduleLabel: string
    description: string
    icon: string                    // SVG path for inline icon rendering
    expectedFor: string[]           // contract_type_keys where this schedule is expected
    requiredFor: string[]           // contract_type_keys where missing = risk flag
    displayOrder: number
}

export type ScheduleDetectionStatus = 'pending' | 'processing' | 'complete' | 'failed'
export type ScheduleStatus = 'detected' | 'confirmed' | 'rejected'

export interface DetectedSchedule {
    schedule_id: string
    contract_id: string
    schedule_type: string
    schedule_label: string
    detection_method: 'ai' | 'manual' | 'keyword'
    confidence_score: number
    start_position: number | null
    end_position: number | null
    extracted_text: string | null
    summary: string | null
    status: ScheduleStatus
    checklist_status?: string | null
    checklist_score?: number | null
    created_at: string
    updated_at: string
}

export interface ScheduleExpectation {
    scheduleType: string
    scheduleLabel: string
    isRequired: boolean
    importanceLevel: number
    detected: boolean
    detectedSchedule: DetectedSchedule | null
}


// ============================================================================
// SECTION 2: SCHEDULE TYPE DEFINITIONS
// ============================================================================

export const SCHEDULE_TYPE_DEFINITIONS: ScheduleTypeDefinition[] = [
    {
        scheduleType: 'scope_of_work',
        scheduleLabel: 'Scope of Work',
        description: 'Deliverables, milestones, acceptance criteria, resources, and project timelines',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
        expectedFor: ['service_agreement', 'bpo_agreement', 'it_outsourcing', 'managed_services', 'consultancy_agreement', 'construction_contract'],
        requiredFor: ['bpo_agreement', 'it_outsourcing', 'managed_services'],
        displayOrder: 1,
    },
    {
        scheduleType: 'pricing',
        scheduleLabel: 'Pricing Schedule',
        description: 'Rate cards, fee structures, indexation caps, volume discounts, and payment mechanics',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        expectedFor: ['service_agreement', 'bpo_agreement', 'it_outsourcing', 'managed_services', 'saas_agreement', 'consultancy_agreement', 'maintenance_agreement'],
        requiredFor: ['bpo_agreement', 'it_outsourcing', 'managed_services'],
        displayOrder: 2,
    },
    {
        scheduleType: 'service_levels',
        scheduleLabel: 'Service Level Agreement',
        description: 'SLA targets, KPIs, measurement methodology, service credits, and remedies',
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
        expectedFor: ['service_agreement', 'bpo_agreement', 'it_outsourcing', 'managed_services', 'saas_agreement', 'maintenance_agreement'],
        requiredFor: ['bpo_agreement', 'it_outsourcing', 'saas_agreement'],
        displayOrder: 3,
    },
    {
        scheduleType: 'data_processing',
        scheduleLabel: 'Data Processing Agreement',
        description: 'GDPR/data protection terms, sub-processors, data retention, cross-border transfers, and breach notification',
        icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
        expectedFor: ['service_agreement', 'bpo_agreement', 'it_outsourcing', 'managed_services', 'saas_agreement'],
        requiredFor: ['bpo_agreement', 'it_outsourcing', 'saas_agreement'],
        displayOrder: 4,
    },
    {
        scheduleType: 'governance',
        scheduleLabel: 'Governance Schedule',
        description: 'Steering committees, reporting cadence, escalation procedures, and relationship management',
        icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
        expectedFor: ['bpo_agreement', 'it_outsourcing', 'managed_services'],
        requiredFor: ['bpo_agreement'],
        displayOrder: 5,
    },
    {
        scheduleType: 'exit_transition',
        scheduleLabel: 'Exit & Transition Plan',
        description: 'Transition timelines, knowledge transfer, data migration, parallel running, and handover procedures',
        icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
        expectedFor: ['bpo_agreement', 'it_outsourcing', 'managed_services'],
        requiredFor: ['bpo_agreement', 'it_outsourcing'],
        displayOrder: 6,
    },
    {
        scheduleType: 'insurance',
        scheduleLabel: 'Insurance Schedule',
        description: 'Required coverage levels, professional indemnity, public liability, evidence obligations',
        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
        expectedFor: ['service_agreement', 'bpo_agreement', 'it_outsourcing', 'construction_contract'],
        requiredFor: [],
        displayOrder: 7,
    },
    {
        scheduleType: 'change_control',
        scheduleLabel: 'Change Control Procedure',
        description: 'Change request process, impact assessment, approval workflow, and pricing for changes',
        icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
        expectedFor: ['bpo_agreement', 'it_outsourcing', 'managed_services', 'construction_contract'],
        requiredFor: [],
        displayOrder: 8,
    },
    {
        scheduleType: 'disaster_recovery',
        scheduleLabel: 'Disaster Recovery & Business Continuity',
        description: 'DR plans, RPO/RTO targets, failover procedures, and business continuity obligations',
        icon: 'M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
        expectedFor: ['bpo_agreement', 'it_outsourcing', 'managed_services', 'saas_agreement'],
        requiredFor: ['bpo_agreement', 'it_outsourcing'],
        displayOrder: 9,
    },
    {
        scheduleType: 'security',
        scheduleLabel: 'Security Schedule',
        description: 'Information security requirements, access controls, penetration testing, and audit rights',
        icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
        expectedFor: ['bpo_agreement', 'it_outsourcing', 'managed_services', 'saas_agreement'],
        requiredFor: [],
        displayOrder: 10,
    },
    {
        scheduleType: 'benchmarking',
        scheduleLabel: 'Benchmarking Schedule',
        description: 'Benchmarking rights, methodology, frequency, and adjustment mechanisms',
        icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
        expectedFor: ['bpo_agreement', 'it_outsourcing'],
        requiredFor: [],
        displayOrder: 11,
    },
    {
        scheduleType: 'subcontracting',
        scheduleLabel: 'Approved Subcontractors',
        description: 'Pre-approved subcontractors, approval process, and flow-down obligations',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
        expectedFor: ['bpo_agreement', 'it_outsourcing'],
        requiredFor: [],
        displayOrder: 12,
    },
    {
        scheduleType: 'other',
        scheduleLabel: 'Other Schedule',
        description: 'Additional schedules not covered by standard types',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        expectedFor: [],
        requiredFor: [],
        displayOrder: 99,
    },
]


// ============================================================================
// SECTION 3: VALID SCHEDULE TYPES (for validation)
// ============================================================================

export const VALID_SCHEDULE_TYPES = SCHEDULE_TYPE_DEFINITIONS.map(s => s.scheduleType)


// ============================================================================
// SECTION 4: HELPER FUNCTIONS
// ============================================================================

/**
 * Get schedule types expected for a given contract type.
 */
export function getExpectedSchedules(contractTypeKey: string): ScheduleTypeDefinition[] {
    return SCHEDULE_TYPE_DEFINITIONS.filter(s => s.expectedFor.includes(contractTypeKey))
}

/**
 * Get schedule types required for a given contract type (missing = risk flag).
 */
export function getRequiredSchedules(contractTypeKey: string): ScheduleTypeDefinition[] {
    return SCHEDULE_TYPE_DEFINITIONS.filter(s => s.requiredFor.includes(contractTypeKey))
}

/**
 * Get display label for a schedule type key.
 */
export function getScheduleTypeLabel(scheduleType: string): string {
    const def = SCHEDULE_TYPE_DEFINITIONS.find(s => s.scheduleType === scheduleType)
    return def?.scheduleLabel || scheduleType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Get the full definition for a schedule type.
 */
export function getScheduleTypeDefinition(scheduleType: string): ScheduleTypeDefinition | undefined {
    return SCHEDULE_TYPE_DEFINITIONS.find(s => s.scheduleType === scheduleType)
}

/**
 * Build expected vs. detected comparison for a contract.
 */
export function buildScheduleExpectations(
    contractTypeKey: string,
    detectedSchedules: DetectedSchedule[]
): ScheduleExpectation[] {
    const expected = getExpectedSchedules(contractTypeKey)
    const required = new Set(getRequiredSchedules(contractTypeKey).map(s => s.scheduleType))

    const expectations: ScheduleExpectation[] = expected.map(def => {
        const match = detectedSchedules.find(d => d.schedule_type === def.scheduleType)
        return {
            scheduleType: def.scheduleType,
            scheduleLabel: def.scheduleLabel,
            isRequired: required.has(def.scheduleType),
            importanceLevel: required.has(def.scheduleType) ? 9 : 5,
            detected: !!match,
            detectedSchedule: match || null,
        }
    })

    // Add any detected schedules that weren't in the expected list
    for (const detected of detectedSchedules) {
        if (!expectations.find(e => e.scheduleType === detected.schedule_type)) {
            expectations.push({
                scheduleType: detected.schedule_type,
                scheduleLabel: detected.schedule_label,
                isRequired: false,
                importanceLevel: 3,
                detected: true,
                detectedSchedule: detected,
            })
        }
    }

    return expectations
}
