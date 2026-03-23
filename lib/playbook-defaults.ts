// ============================================================================
// PLAYBOOK DEFAULTS — Static rule templates for guided playbook creation
// Location: lib/playbook-defaults.ts
//
// Provides perspective-aware default rules per category. Used by the
// PlaybookIQ Creation Wizard when building a playbook from scratch.
// ============================================================================

import type { PlaybookRangeContext } from './playbook-compliance'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface DefaultRuleTemplate {
    clause_name: string
    clause_code: string
    category: string
    schedule_type?: string | null
    customer_ideal: number
    customer_min: number
    customer_max: number
    customer_fallback: number
    provider_ideal: number
    provider_min: number
    provider_max: number
    provider_fallback: number
    importance_level: number
    is_deal_breaker: boolean
    rationale: string
    negotiation_tips: string | null
}

export interface DraftRule {
    tempId: string
    clause_name: string
    clause_code: string | null
    category: string
    schedule_type?: string | null
    ideal_position: number
    minimum_position: number
    maximum_position: number
    fallback_position: number
    is_deal_breaker: boolean
    is_non_negotiable: boolean
    requires_approval_below: number | null
    importance_level: number
    rationale: string | null
    negotiation_tips: string | null
    range_context: PlaybookRangeContext | null
    display_order: number
}

// ============================================================================
// SECTION 2: CATEGORY DESCRIPTIONS (for the category selection step)
// ============================================================================

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
    liability: 'Caps, exclusions, and indemnification limits',
    payment: 'Payment terms, late interest, and invoice disputes',
    termination: 'Notice periods, termination rights, and cure periods',
    confidentiality: 'Duration, scope, and return/destruction obligations',
    service_levels: 'Uptime SLAs, service credits, and remedies',
    insurance: 'Professional indemnity, public liability coverage',
    data_protection: 'Breach notification, sub-processors, audit rights',
    intellectual_property: 'IP ownership, licensing, and deliverable rights',
}

// ============================================================================
// SECTION 3: DEFAULT RULE TEMPLATES
// ============================================================================

export const DEFAULT_RULE_TEMPLATES: Record<string, DefaultRuleTemplate[]> = {
    liability: [
        {
            clause_name: 'Aggregate Liability Cap',
            clause_code: 'LIA-001',
            category: 'liability',
            customer_ideal: 8, customer_min: 5, customer_max: 10, customer_fallback: 6,
            provider_ideal: 3, provider_min: 1, provider_max: 5, provider_fallback: 4,
            importance_level: 9,
            is_deal_breaker: true,
            rationale: 'Sets the maximum financial exposure under the contract',
            negotiation_tips: 'Link cap to annual contract value; market standard is 100-200% of annual fees',
        },
        {
            clause_name: 'Consequential Loss Exclusion',
            clause_code: 'LIA-002',
            category: 'liability',
            customer_ideal: 7, customer_min: 4, customer_max: 9, customer_fallback: 5,
            provider_ideal: 2, provider_min: 1, provider_max: 4, provider_fallback: 3,
            importance_level: 8,
            is_deal_breaker: false,
            rationale: 'Determines scope of indirect/consequential damages recoverable',
            negotiation_tips: 'Push for carve-outs for IP infringement and data breach even if general exclusion applies',
        },
    ],
    payment: [
        {
            clause_name: 'Payment Terms',
            clause_code: 'PAY-001',
            category: 'payment',
            customer_ideal: 3, customer_min: 1, customer_max: 5, customer_fallback: 2,
            provider_ideal: 8, provider_min: 5, provider_max: 10, provider_fallback: 7,
            importance_level: 7,
            is_deal_breaker: false,
            rationale: 'Defines the number of days within which invoices must be paid',
            negotiation_tips: 'Industry standard is 30 days; larger enterprises often push for 60-90',
        },
        {
            clause_name: 'Late Payment Interest',
            clause_code: 'PAY-002',
            category: 'payment',
            customer_ideal: 3, customer_min: 1, customer_max: 5, customer_fallback: 2,
            provider_ideal: 7, provider_min: 4, provider_max: 9, provider_fallback: 6,
            importance_level: 5,
            is_deal_breaker: false,
            rationale: 'Interest rate applied to overdue invoices',
            negotiation_tips: 'Statutory interest rate is often the fallback; avoid punitive rates',
        },
    ],
    termination: [
        {
            clause_name: 'Termination for Convenience',
            clause_code: 'TER-001',
            category: 'termination',
            customer_ideal: 8, customer_min: 5, customer_max: 10, customer_fallback: 6,
            provider_ideal: 3, provider_min: 1, provider_max: 5, provider_fallback: 4,
            importance_level: 8,
            is_deal_breaker: false,
            rationale: 'Right to exit the contract without cause with appropriate notice',
            negotiation_tips: 'Negotiate minimum notice period and transition assistance obligations',
        },
        {
            clause_name: 'Termination for Cause',
            clause_code: 'TER-002',
            category: 'termination',
            customer_ideal: 8, customer_min: 6, customer_max: 10, customer_fallback: 7,
            provider_ideal: 4, provider_min: 2, provider_max: 6, provider_fallback: 5,
            importance_level: 9,
            is_deal_breaker: false,
            rationale: 'Right to terminate due to material breach after cure period',
            negotiation_tips: 'Ensure clear definition of material breach and reasonable cure period (typically 30 days)',
        },
    ],
    confidentiality: [
        {
            clause_name: 'Confidentiality Period',
            clause_code: 'CON-001',
            category: 'confidentiality',
            customer_ideal: 7, customer_min: 4, customer_max: 10, customer_fallback: 5,
            provider_ideal: 3, provider_min: 1, provider_max: 5, provider_fallback: 4,
            importance_level: 7,
            is_deal_breaker: false,
            rationale: 'Duration of confidentiality obligations post-termination',
            negotiation_tips: 'Trade secrets should be perpetual; commercial info typically 2-5 years',
        },
    ],
    service_levels: [
        {
            clause_name: 'Uptime SLA',
            clause_code: 'SLA-001',
            category: 'service_levels',
            customer_ideal: 8, customer_min: 5, customer_max: 10, customer_fallback: 6,
            provider_ideal: 3, provider_min: 1, provider_max: 5, provider_fallback: 4,
            importance_level: 8,
            is_deal_breaker: false,
            rationale: 'Minimum availability guarantee for the service',
            negotiation_tips: '99.9% is market standard for SaaS; insist on measurement methodology',
        },
        {
            clause_name: 'Service Credits',
            clause_code: 'SLA-002',
            category: 'service_levels',
            customer_ideal: 7, customer_min: 4, customer_max: 9, customer_fallback: 5,
            provider_ideal: 3, provider_min: 1, provider_max: 5, provider_fallback: 4,
            importance_level: 6,
            is_deal_breaker: false,
            rationale: 'Financial remedies when SLA targets are missed',
            negotiation_tips: 'Ensure credits are meaningful (5-15% of monthly fee) and not sole remedy',
        },
    ],
    insurance: [
        {
            clause_name: 'Professional Indemnity Insurance',
            clause_code: 'INS-001',
            category: 'insurance',
            customer_ideal: 7, customer_min: 4, customer_max: 10, customer_fallback: 5,
            provider_ideal: 3, provider_min: 1, provider_max: 5, provider_fallback: 4,
            importance_level: 6,
            is_deal_breaker: false,
            rationale: 'Minimum PI cover the provider must maintain',
            negotiation_tips: 'Standard is 1-5M GBP depending on contract size; ensure cover maintained for 6 years post-completion',
        },
    ],
    data_protection: [
        {
            clause_name: 'Data Breach Notification',
            clause_code: 'DPA-001',
            category: 'data_protection',
            customer_ideal: 8, customer_min: 5, customer_max: 10, customer_fallback: 6,
            provider_ideal: 3, provider_min: 1, provider_max: 5, provider_fallback: 4,
            importance_level: 9,
            is_deal_breaker: true,
            rationale: 'Time within which provider must notify of a personal data breach',
            negotiation_tips: 'GDPR requires 72-hour notification to ICO; contractual obligation should be tighter (24-48 hours)',
        },
        {
            clause_name: 'Sub-Processor Controls',
            clause_code: 'DPA-002',
            category: 'data_protection',
            customer_ideal: 7, customer_min: 4, customer_max: 9, customer_fallback: 5,
            provider_ideal: 3, provider_min: 1, provider_max: 5, provider_fallback: 4,
            importance_level: 7,
            is_deal_breaker: false,
            rationale: 'Level of control over provider appointing sub-processors',
            negotiation_tips: 'Seek prior written consent or at minimum 30-day objection window',
        },
    ],
    intellectual_property: [
        {
            clause_name: 'IP Ownership of Deliverables',
            clause_code: 'IP-001',
            category: 'intellectual_property',
            customer_ideal: 8, customer_min: 5, customer_max: 10, customer_fallback: 6,
            provider_ideal: 2, provider_min: 1, provider_max: 4, provider_fallback: 3,
            importance_level: 8,
            is_deal_breaker: false,
            rationale: 'Who owns IP created during the engagement',
            negotiation_tips: 'Distinguish between bespoke deliverables (customer should own) and pre-existing IP (provider retains with licence)',
        },
    ],
}

// ============================================================================
// SECTION 4: DEFAULT SCHEDULE RULE TEMPLATES
// ============================================================================

export const DEFAULT_SCHEDULE_RULE_TEMPLATES: Record<string, DefaultRuleTemplate[]> = {
    service_levels: [
        {
            clause_name: 'Uptime SLA Target',
            clause_code: 'SCH-SLA-001',
            category: 'service_levels',
            schedule_type: 'service_levels',
            customer_ideal: 8, customer_min: 5, customer_max: 10, customer_fallback: 6,
            provider_ideal: 3, provider_min: 1, provider_max: 5, provider_fallback: 4,
            importance_level: 9,
            is_deal_breaker: true,
            rationale: 'Core availability commitment — typically 99.5-99.9% for critical services',
            negotiation_tips: 'Insist on clear measurement methodology and exclusion windows',
        },
        {
            clause_name: 'Service Credits Cap',
            clause_code: 'SCH-SLA-002',
            category: 'service_levels',
            schedule_type: 'service_levels',
            customer_ideal: 7, customer_min: 4, customer_max: 9, customer_fallback: 5,
            provider_ideal: 3, provider_min: 1, provider_max: 5, provider_fallback: 4,
            importance_level: 7,
            is_deal_breaker: false,
            rationale: 'Maximum service credits payable when SLA targets are missed',
            negotiation_tips: 'Ensure credits are not the sole remedy; 10-15% of monthly fees is market standard',
        },
        {
            clause_name: 'Response Time SLA',
            clause_code: 'SCH-SLA-003',
            category: 'service_levels',
            schedule_type: 'service_levels',
            customer_ideal: 7, customer_min: 4, customer_max: 9, customer_fallback: 5,
            provider_ideal: 4, provider_min: 2, provider_max: 6, provider_fallback: 5,
            importance_level: 7,
            is_deal_breaker: false,
            rationale: 'Maximum response time for incidents by severity level',
            negotiation_tips: 'Define severity levels clearly; P1 response should be under 1 hour',
        },
    ],
    pricing: [
        {
            clause_name: 'Annual Indexation Cap',
            clause_code: 'SCH-PRC-001',
            category: 'payment',
            schedule_type: 'pricing',
            customer_ideal: 3, customer_min: 1, customer_max: 5, customer_fallback: 2,
            provider_ideal: 7, provider_min: 4, provider_max: 9, provider_fallback: 6,
            importance_level: 8,
            is_deal_breaker: false,
            rationale: 'Maximum annual price increase percentage — controls cost predictability',
            negotiation_tips: 'Cap at CPI or 3-5%; avoid uncapped "reasonable increase" language',
        },
        {
            clause_name: 'Volume Discount Thresholds',
            clause_code: 'SCH-PRC-002',
            category: 'payment',
            schedule_type: 'pricing',
            customer_ideal: 7, customer_min: 4, customer_max: 9, customer_fallback: 5,
            provider_ideal: 3, provider_min: 1, provider_max: 5, provider_fallback: 4,
            importance_level: 6,
            is_deal_breaker: false,
            rationale: 'Tiered discounts as consumption/volume increases',
            negotiation_tips: 'Ensure thresholds are achievable and discounts are meaningful (10%+)',
        },
        {
            clause_name: 'Rate Review Mechanism',
            clause_code: 'SCH-PRC-003',
            category: 'payment',
            schedule_type: 'pricing',
            customer_ideal: 7, customer_min: 4, customer_max: 9, customer_fallback: 5,
            provider_ideal: 4, provider_min: 2, provider_max: 6, provider_fallback: 5,
            importance_level: 7,
            is_deal_breaker: false,
            rationale: 'Process and timing for periodic rate reviews',
            negotiation_tips: 'Annual review with benchmarking rights; lock rates for initial term minimum',
        },
    ],
    exit_transition: [
        {
            clause_name: 'Minimum Exit Period',
            clause_code: 'SCH-EXT-001',
            category: 'termination',
            schedule_type: 'exit_transition',
            customer_ideal: 7, customer_min: 4, customer_max: 9, customer_fallback: 5,
            provider_ideal: 4, provider_min: 2, provider_max: 6, provider_fallback: 5,
            importance_level: 8,
            is_deal_breaker: false,
            rationale: 'Minimum transition period the provider must support on exit',
            negotiation_tips: 'Ensure minimum 6 months for complex BPO; 3 months for SaaS',
        },
        {
            clause_name: 'Knowledge Transfer Duration',
            clause_code: 'SCH-EXT-002',
            category: 'termination',
            schedule_type: 'exit_transition',
            customer_ideal: 7, customer_min: 4, customer_max: 9, customer_fallback: 5,
            provider_ideal: 3, provider_min: 1, provider_max: 5, provider_fallback: 4,
            importance_level: 7,
            is_deal_breaker: false,
            rationale: 'Time allocated for knowledge transfer to successor provider',
            negotiation_tips: 'Include named key personnel; define minimum documentation deliverables',
        },
        {
            clause_name: 'Data Migration Timeline',
            clause_code: 'SCH-EXT-003',
            category: 'termination',
            schedule_type: 'exit_transition',
            customer_ideal: 8, customer_min: 5, customer_max: 10, customer_fallback: 6,
            provider_ideal: 3, provider_min: 1, provider_max: 5, provider_fallback: 4,
            importance_level: 8,
            is_deal_breaker: true,
            rationale: 'Obligation to return/migrate all data within a defined period',
            negotiation_tips: 'Insist on machine-readable format; data destruction certification post-migration',
        },
    ],
}

// ============================================================================
// SECTION 5: DRAFT RULE GENERATOR
// ============================================================================

export function generateDefaultRules(
    perspective: 'customer' | 'provider',
    selectedCategories: string[]
): DraftRule[] {
    const rules: DraftRule[] = []
    let displayOrder = 1

    for (const category of selectedCategories) {
        const templates = DEFAULT_RULE_TEMPLATES[category] || []
        for (const tmpl of templates) {
            rules.push({
                tempId: crypto.randomUUID(),
                clause_name: tmpl.clause_name,
                clause_code: tmpl.clause_code,
                category: tmpl.category,
                schedule_type: tmpl.schedule_type || null,
                ideal_position: perspective === 'customer' ? tmpl.customer_ideal : tmpl.provider_ideal,
                minimum_position: perspective === 'customer' ? tmpl.customer_min : tmpl.provider_min,
                maximum_position: perspective === 'customer' ? tmpl.customer_max : tmpl.provider_max,
                fallback_position: perspective === 'customer' ? tmpl.customer_fallback : tmpl.provider_fallback,
                is_deal_breaker: tmpl.is_deal_breaker,
                is_non_negotiable: false,
                requires_approval_below: perspective === 'customer' ? tmpl.customer_fallback : tmpl.provider_fallback,
                importance_level: tmpl.importance_level,
                rationale: tmpl.rationale,
                negotiation_tips: tmpl.negotiation_tips,
                range_context: null,
                display_order: displayOrder++,
            })
        }
    }
    return rules
}
