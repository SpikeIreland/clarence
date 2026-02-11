// ============================================================================
// FILE: lib/useRoleContext.ts
// PURPOSE: React hook to fetch and derive role context for any contract/session
// DEPLOY TO: /lib/useRoleContext.ts
// ============================================================================
// Usage in QC Studio:
//   const roleContext = useRoleContext({ contractId, userId })
//
// Usage in Contract Studio:
//   const roleContext = useRoleContext({ sessionId, userId })
//
// Returns RoleContext with "Favours You" / "Favours Them" labels,
// or falls back to generic Customer/Provider when role data not available.
// ============================================================================

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getRoleContext, type RoleContext, type PartyRole } from '@/lib/role-matrix'


// ============================================================================
// SECTION 1: HOOK INTERFACE
// ============================================================================

interface UseRoleContextParams {
    contractId?: string | null     // For QC Studio (uploaded_contracts)
    sessionId?: string | null      // For Contract Studio (sessions)
    userId?: string | null         // Current user's ID
}

interface UseRoleContextResult {
    roleContext: RoleContext | null
    isLoading: boolean
    hasRoleData: boolean           // Whether role data exists in DB
}


// ============================================================================
// SECTION 2: DEFAULT FALLBACK CONTEXT
// ============================================================================
// Used when no role data exists (pre-Phase 1 contracts)

const DEFAULT_CUSTOMER_CONTEXT: RoleContext = {
    userPartyRole: 'protected',
    userRoleLabel: 'Customer',
    counterpartyRoleLabel: 'Provider',
    positionFavorEnd: 10,
    contractTypeName: 'Service Agreement',
    protectedPartyLabel: 'Customer',
    providingPartyLabel: 'Provider',
}

const DEFAULT_PROVIDER_CONTEXT: RoleContext = {
    userPartyRole: 'providing',
    userRoleLabel: 'Provider',
    counterpartyRoleLabel: 'Customer',
    positionFavorEnd: 1,
    contractTypeName: 'Service Agreement',
    protectedPartyLabel: 'Customer',
    providingPartyLabel: 'Provider',
}


// ============================================================================
// SECTION 3: THE HOOK
// ============================================================================

export function useRoleContext({
    contractId,
    sessionId,
    userId,
}: UseRoleContextParams): UseRoleContextResult {
    const [roleContext, setRoleContext] = useState<RoleContext | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [hasRoleData, setHasRoleData] = useState(false)

    useEffect(() => {
        if (!userId) {
            setIsLoading(false)
            return
        }

        const fetchRoleData = async () => {
            setIsLoading(true)
            const supabase = createClient()

            try {
                let contractTypeKey: string | null = null
                let initiatorPartyRole: PartyRole | null = null
                let isInitiator = false

                // ============================================================
                // PATH A: QC Studio - fetch from uploaded_contracts
                // ============================================================
                if (contractId) {
                    const { data, error } = await supabase
                        .from('uploaded_contracts')
                        .select('contract_type_key, initiator_party_role, uploaded_by_user_id')
                        .eq('contract_id', contractId)
                        .single()

                    if (!error && data) {
                        contractTypeKey = data.contract_type_key
                        initiatorPartyRole = data.initiator_party_role as PartyRole | null
                        isInitiator = data.uploaded_by_user_id === userId
                    }
                }

                // ============================================================
                // PATH B: Contract Studio - fetch from sessions
                // ============================================================
                if (sessionId && !contractTypeKey) {
                    const { data, error } = await supabase
                        .from('sessions')
                        .select('contract_type_key, initiator_party_role, customer_user_id')
                        .eq('session_id', sessionId)
                        .single()

                    if (!error && data) {
                        contractTypeKey = data.contract_type_key
                        initiatorPartyRole = data.initiator_party_role as PartyRole | null
                        isInitiator = data.customer_user_id === userId
                    }
                }

                // ============================================================
                // DERIVE CONTEXT
                // ============================================================
                if (contractTypeKey && initiatorPartyRole) {
                    // Role Matrix data exists - derive full context
                    const context = getRoleContext(
                        contractTypeKey,
                        initiatorPartyRole,
                        isInitiator
                    )
                    setRoleContext(context)
                    setHasRoleData(true)
                } else {
                    // No role data - use fallback based on initiator status
                    // Pre-Phase 1 contracts assumed initiator = customer
                    setRoleContext(isInitiator ? DEFAULT_CUSTOMER_CONTEXT : DEFAULT_PROVIDER_CONTEXT)
                    setHasRoleData(false)
                }
            } catch (err) {
                console.error('[useRoleContext] Error fetching role data:', err)
                // Safe fallback
                setRoleContext(DEFAULT_CUSTOMER_CONTEXT)
                setHasRoleData(false)
            } finally {
                setIsLoading(false)
            }
        }

        fetchRoleData()
    }, [contractId, sessionId, userId])

    return { roleContext, isLoading, hasRoleData }
}


// ============================================================================
// SECTION 4: HELPER - GET SCALE LABELS
// ============================================================================
// Convenience function to get the correct labels for position scale ends.
// Always returns { leftLabel, rightLabel } where left=1, right=10.

export interface ScaleLabels {
    leftLabel: string       // Position 1 end (providing party favoured)
    rightLabel: string      // Position 10 end (protected party favoured)
    leftYouThem: string     // "Favours You" or "Favours Them"
    rightYouThem: string    // "Favours You" or "Favours Them"
}

export function getScaleLabels(roleContext: RoleContext | null): ScaleLabels {
    if (!roleContext) {
        return {
            leftLabel: 'Provider-Favoring',
            rightLabel: 'Customer-Favoring',
            leftYouThem: '',
            rightYouThem: '',
        }
    }

    const leftParty = roleContext.providingPartyLabel    // Position 1
    const rightParty = roleContext.protectedPartyLabel   // Position 10

    return {
        leftLabel: `${leftParty}-Favoring`,
        rightLabel: `${rightParty}-Favoring`,
        leftYouThem: roleContext.positionFavorEnd === 1 ? 'Favours You' : 'Favours Them',
        rightYouThem: roleContext.positionFavorEnd === 10 ? 'Favours You' : 'Favours Them',
    }
}