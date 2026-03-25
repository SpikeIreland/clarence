// ============================================================================
// PLAYBOOK LOADER — Shared utility for finding the best-matching active playbook
// Location: lib/playbook-loader.ts
//
// Three-tier lookup:
// 1. Type-specific: exact match on contract_type_key
// 2. General fallback: playbook with NULL contract_type_key
// 3. Any active: best-effort backward compatibility
// ============================================================================

import { createClient } from '@/lib/supabase'

// Maps local session contract type values → canonical contract_type_key
// (same canonical 20-key list from contract_type_roles.contract_type_key)
const DOCUMENT_TYPE_KEY_MAP: Record<string, string> = {
    'nda':          'nda_mutual',
    'bpo':          'bpo_agreement',
    'saas':         'saas_agreement',
    'msa':          'service_agreement',
    'employment':   'employment_contract',
    'it_services':  'it_outsourcing',
    'consulting':   'consultancy_agreement',
    'custom':       'service_agreement',
}

/** Normalise a raw contract type value to its canonical document_type_key. */
export function normaliseContractTypeKey(raw: string | null): string | null {
    if (!raw) return null
    return DOCUMENT_TYPE_KEY_MAP[raw] ?? raw
}

export interface PlaybookMatch {
    playbook_id: string
    playbook_name: string
    company_id: string
    contract_type_key: string | null
    playbook_perspective: 'customer' | 'provider'
}

const PLAYBOOK_FIELDS = 'playbook_id, playbook_name, company_id, contract_type_key, playbook_perspective'

/**
 * Find the best-matching active playbook for a company and contract type.
 * Priority: type-specific > general (null type) > any active
 */
export async function findActivePlaybook(
    companyId: string,
    contractTypeKey: string | null
): Promise<PlaybookMatch | null> {
    const supabase = createClient()
    const canonicalKey = normaliseContractTypeKey(contractTypeKey)

    // Tier 1: Type-specific match (using canonical key)
    if (canonicalKey) {
        const { data } = await supabase
            .from('company_playbooks')
            .select(PLAYBOOK_FIELDS)
            .eq('company_id', companyId)
            .eq('is_active', true)
            .eq('contract_type_key', canonicalKey)
            .limit(1)
            .maybeSingle()

        if (data) return data as PlaybookMatch
    }

    // Tier 2: General (null type) fallback
    const { data: general } = await supabase
        .from('company_playbooks')
        .select(PLAYBOOK_FIELDS)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .is('contract_type_key', null)
        .limit(1)
        .maybeSingle()

    if (general) return general as PlaybookMatch

    // Tier 3 removed — returning null prevents wrong-playbook matching
    // (previously returned any active playbook regardless of contract type)
    return null
}

/**
 * Load a playbook directly by its ID.
 * Used when a template has an explicit linked_playbook_id.
 */
export async function findPlaybookById(
    playbookId: string
): Promise<PlaybookMatch | null> {
    const supabase = createClient()
    const { data } = await supabase
        .from('company_playbooks')
        .select(PLAYBOOK_FIELDS)
        .eq('playbook_id', playbookId)
        .maybeSingle()
    return (data as PlaybookMatch) || null
}
