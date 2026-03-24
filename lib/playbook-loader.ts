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

    // Tier 1: Type-specific match
    if (contractTypeKey) {
        const { data } = await supabase
            .from('company_playbooks')
            .select(PLAYBOOK_FIELDS)
            .eq('company_id', companyId)
            .eq('is_active', true)
            .eq('contract_type_key', contractTypeKey)
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
