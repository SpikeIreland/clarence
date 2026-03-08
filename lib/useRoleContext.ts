// ============================================================================
// FILE: lib/useRoleContext.ts
// PURPOSE: React hook to fetch and derive role context for any contract/session
// DEPLOY TO: /lib/useRoleContext.ts
// ============================================================================
// Usage in QC Studio:
//   const { roleContext } = useRoleContext({ contractId, userId })
//
// Usage in Contract Studio:
//   const { roleContext } = useRoleContext({ sessionId, userId })
//
// Returns RoleContext with dynamic party labels from the Role Matrix,
// or falls back gracefully when role data is incomplete or missing.
// ============================================================================

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getRoleContext, getContractType, type RoleContext, type PartyRole } from '@/lib/role-matrix'


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
    hasRoleData: boolean           // Whether full role data exists in DB
}


// ============================================================================
// SECTION 2: DEFAULT FALLBACK CONTEXTS
// ============================================================================
// Used when no role data at all exists (pre-Phase 1 contracts with no
// contract_type_key). Uses neutral Party A / Party B labels.

const DEFAULT_NEUTRAL_CONTEXT: RoleContext = {
    userPartyRole: 'protected',
    userRoleLabel: 'Party A',
    counterpartyRoleLabel: 'Party B',
    positionFavorEnd: 10,
    contractTypeName: 'Contract',
    protectedPartyLabel: 'Party A',
    providingPartyLabel: 'Party B',
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
        if (!contractId && !sessionId) {
            setIsLoading(false)
            return
        }

        const supabase = createClient()

        async function fetchRoleData() {
            try {
                let contractTypeKey: string | null = null
                let initiatorPartyRole: PartyRole | null = null
                let isInitiator = true // Default assumption

                // ============================================================
                // PATH A: QC Studio — fetch from uploaded_contracts
                // ============================================================
                if (contractId) {
                    const { data, error } = await supabase
                        .from('uploaded_contracts')
                        .select('contract_type_key, initiator_party_role, uploaded_by_user_id, linked_session_id')
                        .eq('contract_id', contractId)
                        .single()

                    if (!error && data) {
                        contractTypeKey = data.contract_type_key
                        initiatorPartyRole = data.initiator_party_role as PartyRole | null
                        isInitiator = data.uploaded_by_user_id === userId

                        // Fallback: if uploaded_contracts has no role data,
                        // check the linked session (which stores it from assessment)
                        if (!contractTypeKey && data.linked_session_id) {
                            const { data: sessionData } = await supabase
                                .from('sessions')
                                .select('contract_type_key, initiator_party_role, customer_id')
                                .eq('session_id', data.linked_session_id)
                                .single()

                            if (sessionData) {
                                contractTypeKey = sessionData.contract_type_key
                                initiatorPartyRole = sessionData.initiator_party_role as PartyRole | null
                                isInitiator = sessionData.customer_id === userId
                            }
                        }
                    }
                }

                // ============================================================
                // PATH B: Contract Studio — fetch from sessions
                // ============================================================
                if (sessionId && !contractTypeKey) {
                    const { data, error } = await supabase
                        .from('sessions')
                        .select('contract_type_key, initiator_party_role, customer_id')
                        .eq('session_id', sessionId)
                        .single()

                    if (!error && data) {
                        contractTypeKey = data.contract_type_key
                        initiatorPartyRole = data.initiator_party_role as PartyRole | null
                        isInitiator = data.customer_id === userId
                    }
                }

                // ============================================================
                // DERIVE CONTEXT — Three-tier fallback
                // ============================================================

                if (contractTypeKey && initiatorPartyRole) {
                    // TIER 1: Full role data — derive complete context with orientation
                    const context = getRoleContext(
                        contractTypeKey,
                        initiatorPartyRole,
                        isInitiator
                    )
                    setRoleContext(context)
                    setHasRoleData(true)

                } else if (contractTypeKey) {
                    // TIER 2: Contract type known but party role not set
                    // Use the correct party LABELS from the type definition
                    // but without user orientation (we don't know which side they're on)
                    const typeDef = getContractType(contractTypeKey)
                    if (typeDef) {
                        setRoleContext({
                            userPartyRole: 'protected',              // Assumed — no orientation
                            userRoleLabel: typeDef.protectedPartyLabel,
                            counterpartyRoleLabel: typeDef.providingPartyLabel,
                            positionFavorEnd: 10,                    // Default orientation
                            contractTypeName: typeDef.contractTypeName,
                            protectedPartyLabel: typeDef.protectedPartyLabel,
                            providingPartyLabel: typeDef.providingPartyLabel,
                        })
                        setHasRoleData(false) // Partial — labels correct, orientation assumed
                    } else {
                        // Type key exists but not in our definitions
                        setRoleContext(DEFAULT_NEUTRAL_CONTEXT)
                        setHasRoleData(false)
                    }

                } else {
                    // TIER 3: No role data at all — use neutral Party A / Party B
                    setRoleContext(DEFAULT_NEUTRAL_CONTEXT)
                    setHasRoleData(false)
                }
            } catch (err) {
                console.error('[useRoleContext] Error fetching role data:', err)
                // Safe fallback
                setRoleContext(DEFAULT_NEUTRAL_CONTEXT)
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
// SECTION 4: HELPER — GET SCALE LABELS
// ============================================================================
// Convenience function to get the correct labels for position scale ends.
// Always returns { leftLabel, rightLabel } where left=1, right=10.

export function getScaleLabels(roleContext: RoleContext | null): {
    leftLabel: string
    rightLabel: string
    leftYouThem: string
    rightYouThem: string
} {
    if (!roleContext) {
        return {
            leftLabel: 'Party B',
            rightLabel: 'Party A',
            leftYouThem: '',
            rightYouThem: '',
        }
    }

    // Determine "Favours You" / "Favours Them" based on which end favours the user
    const leftIsYou = roleContext.positionFavorEnd === 1
    return {
        leftLabel: roleContext.providingPartyLabel,    // Position 1 favours providing party
        rightLabel: roleContext.protectedPartyLabel,   // Position 10 favours protected party
        leftYouThem: leftIsYou ? 'Favours You' : 'Favours Them',
        rightYouThem: leftIsYou ? 'Favours Them' : 'Favours You',
    }
}