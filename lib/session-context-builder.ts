// ============================================================================
// FILE: lib/session-context-builder.ts
// PURPOSE: Build negotiation context for CLARENCE AI from Supabase data
//          Replaces the broken n8n "Build Context" sub-workflow
// ============================================================================

import { createServiceRoleClient } from '@/lib/supabase'
import { getRoleContext, type PartyRole } from '@/lib/role-matrix'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface SessionContext {
    session: {
        contractTypeKey: string | null
        contractType: string
        currentPhase: number
        phaseName: string
        dealValue: number
        currency: string
        industry: string
        status: string
        sessionNumber: string
        initiatorPartyRole: string | null
    }
    viewer: {
        role: 'customer' | 'provider'
        company: string
        name: string
    }
    parties: {
        customer: { companyName: string; name: string; email: string }
        provider: { companyName: string; name: string; email: string }
    }
    leverage: {
        tracker: { customer: number; provider: number }
        leverageBalance: number
        factors: {
            marketDynamics: { score: number; rationale: string }
            economicFactors: { score: number; rationale: string }
            strategicPosition: { score: number; rationale: string }
            batna: { score: number; rationale: string }
        }
    }
    positions: {
        total: number
        agreed: number
        aligned: number
        disputed: number
        alignmentPercentage: number
        averageGapSize: number
        biggestGaps: BiggestGap[]
    }
    recentHistory: {
        lastMoves: PositionMove[]
        recentChatMessages: ChatMsg[]
    }
    partyChat: PartyChatMsg[]
    clauseContext: ClauseContext | null
    playbook: {
        hasPlaybook: boolean
        playbookName: string | null
        totalRules: number
        activeRules: PlaybookRule[]
        activeAlerts: unknown[]
    }
    touchpoint: {
        userMessage: string
    }
    mode: {
        isTraining: boolean
        trainingOpponentType: string | null
        opponentPersonality: string | null
    }
    strategicInsights: {
        customerPriorities: unknown
        customerRedLines: unknown
        providerPriorities: unknown
        providerFlexibility: unknown
    }
}

interface BiggestGap {
    clause_name: string
    customer_position: number
    provider_position: number
    gap_size: number
    position_1_label: string | null
    position_5_label: string | null
    position_10_label: string | null
    customer_position_meaning: string | null
    provider_position_meaning: string | null
}

interface PositionMove {
    partyRole: string
    clauseName: string
    fromPosition: number
    toPosition: number
    position_1_label: string | null
    position_5_label: string | null
    position_10_label: string | null
}

interface ChatMsg {
    senderRole: string
    messageText: string
}

interface PartyChatMsg {
    sender: string
    senderType: string
    message: string
    relatedClauseId: string | null
    timestamp: string
}

interface ClauseContext {
    clauseId: string
    clauseNumber: number
    clauseName: string
    category: string
    clauseContent: string | null
    customerPosition: number | null
    providerPosition: number | null
    gapSize: number | null
    status: string | null
    positionLabels: {
        position_1_label: string | null
        position_5_label: string | null
        position_10_label: string | null
    } | null
}

interface PlaybookRule {
    ruleId: string
    clauseName: string
    category: string
    idealPosition: number | null
    minimumPosition: number | null
    maximumPosition: number | null
    rationale: string | null
    negotiationTips: string | null
    importanceLevel: string | null
    isDealBreaker: boolean
    isNonNegotiable: boolean
}

// ============================================================================
// SECTION 2: PHASE MAP
// ============================================================================

const PHASE_NAMES: Record<number, string> = {
    0: 'Pre-Negotiation',
    1: 'Initial Positions',
    2: 'Active Negotiation',
    3: 'Convergence',
    4: 'Final Alignment',
    5: 'Agreement',
}

// ============================================================================
// SECTION 3: BUILD CONTEXT
// ============================================================================

export async function buildSessionContext(
    sessionId: string,
    viewerRole: 'customer' | 'provider',
    userMessage: string,
    passedContext?: {
        contractTypeKey?: string | null
        initiatorPartyRole?: string | null
        clauseId?: string | null
        clauseName?: string | null
        alignmentScore?: number | null
        viewerCompanyId?: string | null
    }
): Promise<{ success: boolean; context: SessionContext | null; buildTime: number }> {
    const start = Date.now()

    try {
        const supabase = createServiceRoleClient()

        // ------------------------------------------------------------------
        // QUERY 1: Session + customer_requirements + provider_bids
        // ------------------------------------------------------------------
        const { data: sessionRow, error: sessErr } = await supabase
            .from('sessions')
            .select(`
                session_id, session_number, customer_company, status,
                currency, is_training, notes,
                contract_type_key, initiator_party_role,
                leverage_tracker_customer, leverage_tracker_provider,
                leverage_tracker_calculated_at
            `)
            .eq('session_id', sessionId)
            .single()

        if (sessErr || !sessionRow) {
            console.error('[ContextBuilder] Session not found:', sessErr)
            return { success: false, context: null, buildTime: Date.now() - start }
        }

        // ------------------------------------------------------------------
        // QUERY 2-5: Parallel queries
        // ------------------------------------------------------------------
        const [crResult, pbResult, posResult, chatResult, leverageResult, partyMsgResult, posHistResult] = await Promise.all([
            // Customer requirements
            supabase
                .from('customer_requirements')
                .select('deal_value, service_required, industry, contact_name, contact_email, company_name')
                .eq('session_id', sessionId)
                .limit(1)
                .single(),

            // Provider bids (first active one)
            supabase
                .from('provider_bids')
                .select('provider_company, provider_contact_name, provider_contact_email, provider_id')
                .eq('session_id', sessionId)
                .order('invited_at', { ascending: false })
                .limit(1)
                .single(),

            // Clause positions with clause details from contract_clauses JOIN
            // NOTE: clause_name, category, description live on contract_clauses, not session_clause_positions
            supabase
                .from('session_clause_positions')
                .select(`
                    position_id, clause_id, clause_number,
                    customer_position, provider_position,
                    gap_size, gap_severity, status,
                    customer_weight, provider_weight,
                    is_deal_breaker_customer, is_deal_breaker_provider,
                    clause_content,
                    contract_clauses(clause_name, category, description)
                `)
                .eq('session_id', sessionId)
                .order('clause_number', { ascending: true }),

            // Recent chat messages
            supabase
                .from('clause_chat_messages')
                .select('sender, message, created_at')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: false })
                .limit(5),

            // Leverage calculations
            supabase
                .from('leverage_calculations')
                .select('customer_leverage, provider_leverage, alignment_percentage, leverage_factors_breakdown, calculated_at')
                .eq('session_id', sessionId)
                .order('calculated_at', { ascending: false })
                .limit(1)
                .single(),

            // Party-to-party messages (what parties discussed directly)
            supabase
                .from('party_messages')
                .select('sender_type, sender_name, message_text, related_clause_id, created_at')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: false })
                .limit(15),

            // Position change history (recent moves)
            supabase
                .from('position_change_history')
                .select('clause_name, clause_number, party, changed_by_name, old_position, new_position, changed_at')
                .eq('session_id', sessionId)
                .order('changed_at', { ascending: false })
                .limit(20),
        ])

        const cr = crResult.data
        const pb = pbResult.data
        const rawPositions = posResult.data || []
        const chatMessages = chatResult.data || []

        // Log position query result for debugging
        if (posResult.error) {
            console.error('[ContextBuilder] Positions query error:', posResult.error.message)
        }
        console.log('[ContextBuilder] Positions loaded:', rawPositions.length)

        // Flatten the joined contract_clauses data into each position row
        // Supabase returns: { ..., contract_clauses: { clause_name, category, description } }
        const positions: Record<string, unknown>[] = rawPositions.map((p: Record<string, unknown>) => {
            const cc = p.contract_clauses as Record<string, unknown> | null
            return {
                ...p,
                clause_name: cc?.clause_name || null,
                category: cc?.category || null,
                description: cc?.description || null,
            } as Record<string, unknown>
        })
        const leverageCalc = leverageResult.data
        const partyMessages = partyMsgResult.data || []
        const positionHistory = posHistResult.data || []

        // ------------------------------------------------------------------
        // QUERY 6: Playbook (requires viewerCompanyId)
        // ------------------------------------------------------------------
        let playbookData: { playbook_name: string; playbook_id: string } | null = null
        let playbookRules: PlaybookRule[] = []

        if (passedContext?.viewerCompanyId) {
            const { data: pbk } = await supabase
                .from('company_playbooks')
                .select('playbook_id, playbook_name')
                .eq('company_id', passedContext.viewerCompanyId)
                .eq('is_active', true)
                .limit(1)
                .maybeSingle()

            if (pbk) {
                playbookData = pbk
                const { data: rules } = await supabase
                    .from('playbook_rules')
                    .select(`
                        rule_id, clause_name, category,
                        ideal_position, minimum_position, maximum_position,
                        rationale, negotiation_tips,
                        importance_level, is_deal_breaker, is_non_negotiable
                    `)
                    .eq('playbook_id', pbk.playbook_id)
                    .eq('is_active', true)
                    .order('category')
                    .limit(15)

                if (rules) {
                    playbookRules = rules.map((r: Record<string, unknown>) => ({
                        ruleId: r.rule_id as string,
                        clauseName: r.clause_name as string,
                        category: r.category as string,
                        idealPosition: r.ideal_position as number | null,
                        minimumPosition: r.minimum_position as number | null,
                        maximumPosition: r.maximum_position as number | null,
                        rationale: r.rationale as string | null,
                        negotiationTips: r.negotiation_tips as string | null,
                        importanceLevel: r.importance_level as string | null,
                        isDealBreaker: !!r.is_deal_breaker,
                        isNonNegotiable: !!r.is_non_negotiable,
                    }))
                }
            }
        }

        // ------------------------------------------------------------------
        // QUERY 7: Position labels for ALL clauses
        // ------------------------------------------------------------------
        const allClauseIds = positions
            .map((p: Record<string, unknown>) => p.clause_id)
            .filter(Boolean) as string[]

        let allPositionLabels: Record<string, { position_1_label: string | null; position_5_label: string | null; position_10_label: string | null }> = {}

        if (allClauseIds.length > 0) {
            const { data: allLabels } = await supabase
                .from('clause_range_mappings')
                .select('clause_id, position_1_label, position_5_label, position_10_label')
                .in('clause_id', allClauseIds)

            if (allLabels) {
                for (const label of allLabels) {
                    allPositionLabels[label.clause_id as string] = {
                        position_1_label: label.position_1_label as string | null,
                        position_5_label: label.position_5_label as string | null,
                        position_10_label: label.position_10_label as string | null,
                    }
                }
            }
        }

        // ------------------------------------------------------------------
        // QUERY 8: Specific clause detail (when clauseId provided)
        // ------------------------------------------------------------------
        let clauseContext: ClauseContext | null = null

        if (passedContext?.clauseId || passedContext?.clauseName) {
            // Try matching by clause_id first, then fall back to position_id, then clause_name
            let matchingPosition = passedContext?.clauseId
                ? positions.find((p: Record<string, unknown>) => p.clause_id === passedContext.clauseId)
                : null

            if (!matchingPosition && passedContext?.clauseId) {
                // Fallback: clauseId might actually be a position_id
                matchingPosition = positions.find((p: Record<string, unknown>) => p.position_id === passedContext.clauseId)
                if (matchingPosition) {
                    console.log('[ContextBuilder] Clause matched by position_id fallback:', passedContext.clauseId)
                }
            }

            if (!matchingPosition && passedContext?.clauseName) {
                // Fallback: match by clause name (exact)
                const searchName = passedContext.clauseName.toLowerCase().trim()
                matchingPosition = positions.find(
                    (p: Record<string, unknown>) => (p.clause_name as string)?.toLowerCase().trim() === searchName
                )
                // Fallback: partial name match (clause name contains search or vice versa)
                if (!matchingPosition) {
                    matchingPosition = positions.find(
                        (p: Record<string, unknown>) => {
                            const dbName = (p.clause_name as string)?.toLowerCase().trim()
                            return dbName && (dbName.includes(searchName) || searchName.includes(dbName))
                        }
                    )
                }
                if (matchingPosition) {
                    console.log('[ContextBuilder] Clause matched by name fallback:', passedContext.clauseName, '→', (matchingPosition as Record<string, unknown>).clause_name)
                }
            }

            if (matchingPosition) {
                const matchClauseId = (matchingPosition.clause_id as string) || passedContext.clauseId || ''
                const labels = allPositionLabels[matchClauseId] || null
                clauseContext = {
                    clauseId: matchClauseId,
                    clauseNumber: matchingPosition.clause_number as number,
                    clauseName: (matchingPosition.clause_name as string) || passedContext.clauseName || 'Unknown',
                    category: (matchingPosition.category as string) || 'General',
                    clauseContent: (matchingPosition.clause_content as string) || null,
                    customerPosition: matchingPosition.customer_position as number | null,
                    providerPosition: matchingPosition.provider_position as number | null,
                    gapSize: matchingPosition.gap_size as number | null,
                    status: matchingPosition.status as string | null,
                    positionLabels: labels,
                }
            } else {
                console.warn('[ContextBuilder] Clause not found in positions. clauseId:', passedContext?.clauseId, 'clauseName:', passedContext?.clauseName, 'Available clause_ids:', positions.slice(0, 5).map((p: Record<string, unknown>) => p.clause_id))
            }
        }

        // ------------------------------------------------------------------
        // COMPUTE POSITION STATS
        // ------------------------------------------------------------------
        const total = positions.length
        const agreed = positions.filter((p: Record<string, unknown>) =>
            (p.status === 'agreed') ||
            (p.customer_position && p.provider_position && p.customer_position === p.provider_position)
        ).length
        const disputed = positions.filter((p: Record<string, unknown>) =>
            (p.gap_severity === 'high') || ((p.gap_size as number) >= 3)
        ).length
        const aligned = total - disputed - agreed

        const totalGap = positions.reduce((sum: number, p: Record<string, unknown>) =>
            sum + ((p.gap_size as number) || 0), 0)
        const averageGapSize = total > 0 ? +(totalGap / total).toFixed(1) : 0

        // Max possible gap is 9 per clause (positions 1 vs 10)
        const maxTotalGap = total * 9
        const alignmentPercentage = maxTotalGap > 0
            ? Math.round(((maxTotalGap - totalGap) / maxTotalGap) * 100)
            : 0

        // Biggest gaps (top 5) — use pre-fetched position labels
        const biggestGaps: BiggestGap[] = positions
            .filter((p: Record<string, unknown>) => (p.gap_size as number) > 0)
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
                (b.gap_size as number) - (a.gap_size as number))
            .slice(0, 5)
            .map((p: Record<string, unknown>) => {
                const labels = allPositionLabels[p.clause_id as string] || null
                return {
                    clause_name: p.clause_name as string || `Clause ${p.clause_number}`,
                    customer_position: (p.customer_position as number) || 5,
                    provider_position: (p.provider_position as number) || 5,
                    gap_size: (p.gap_size as number) || 0,
                    position_1_label: labels?.position_1_label || null,
                    position_5_label: labels?.position_5_label || null,
                    position_10_label: labels?.position_10_label || null,
                    customer_position_meaning: null,
                    provider_position_meaning: null,
                }
            })

        // ------------------------------------------------------------------
        // DETERMINE PHASE
        // ------------------------------------------------------------------
        let currentPhase = 1
        if (alignmentPercentage >= 95) currentPhase = 5
        else if (alignmentPercentage >= 80) currentPhase = 4
        else if (alignmentPercentage >= 50) currentPhase = 3
        else if (total > 0 && positions.some((p: Record<string, unknown>) =>
            p.customer_position && p.provider_position)) currentPhase = 2
        else currentPhase = 1

        // ------------------------------------------------------------------
        // LEVERAGE
        // ------------------------------------------------------------------
        const leverageTrackerCustomer = (sessionRow.leverage_tracker_customer as number) || 50
        const leverageTrackerProvider = (sessionRow.leverage_tracker_provider as number) || 50
        const leverageBalance = Math.round(100 - Math.abs(leverageTrackerCustomer - leverageTrackerProvider))

        let leverageFactors = {
            marketDynamics: { score: 50, rationale: 'Not assessed' },
            economicFactors: { score: 50, rationale: 'Not assessed' },
            strategicPosition: { score: 50, rationale: 'Not assessed' },
            batna: { score: 50, rationale: 'Not assessed' },
        }
        if (leverageCalc?.leverage_factors_breakdown) {
            try {
                const breakdown = typeof leverageCalc.leverage_factors_breakdown === 'string'
                    ? JSON.parse(leverageCalc.leverage_factors_breakdown)
                    : leverageCalc.leverage_factors_breakdown
                if (breakdown.marketDynamics) leverageFactors = breakdown
            } catch { /* use defaults */ }
        }

        // ------------------------------------------------------------------
        // TRAINING MODE
        // ------------------------------------------------------------------
        const isTraining = !!sessionRow.is_training
        let trainingOpponentType: string | null = null
        let opponentPersonality: string | null = null
        if (isTraining && sessionRow.notes) {
            const opponentMatch = (sessionRow.notes as string).match(/Opponent:\s*(.+)/i)
            if (opponentMatch) trainingOpponentType = opponentMatch[1].trim()
        }

        // ------------------------------------------------------------------
        // PARTY INFO
        // ------------------------------------------------------------------
        const customerCompany = (cr?.company_name as string) || (sessionRow.customer_company as string) || 'Customer'
        const customerName = (cr?.contact_name as string) || 'Customer Contact'
        const customerEmail = (cr?.contact_email as string) || ''
        const providerCompany = (pb?.provider_company as string) || 'Provider'
        const providerName = (pb?.provider_contact_name as string) || 'Provider Contact'
        const providerEmail = (pb?.provider_contact_email as string) || ''

        // ------------------------------------------------------------------
        // RECENT CHAT
        // ------------------------------------------------------------------
        const recentChatMessages: ChatMsg[] = (chatMessages || [])
            .reverse()
            .map((m: Record<string, unknown>) => ({
                senderRole: m.sender as string,
                messageText: (m.message as string || '').substring(0, 200),
            }))

        // ------------------------------------------------------------------
        // PARTY CHAT (party-to-party messages)
        // ------------------------------------------------------------------
        const partyChat: PartyChatMsg[] = (partyMessages || [])
            .reverse()
            .map((m: Record<string, unknown>) => ({
                sender: m.sender_name as string || 'Unknown',
                senderType: m.sender_type as string || 'unknown',
                message: ((m.message_text as string) || '').substring(0, 300),
                relatedClauseId: m.related_clause_id as string | null,
                timestamp: m.created_at as string,
            }))

        // ------------------------------------------------------------------
        // POSITION HISTORY (recent moves)
        // ------------------------------------------------------------------
        const lastMoves: PositionMove[] = (positionHistory || [])
            .map((m: Record<string, unknown>) => {
                const labels = allPositionLabels[m.clause_id as string] || null
                return {
                    partyRole: m.party as string,
                    clauseName: m.clause_name as string || `Clause ${m.clause_number}`,
                    fromPosition: m.old_position as number,
                    toPosition: m.new_position as number,
                    position_1_label: labels?.position_1_label || null,
                    position_5_label: labels?.position_5_label || null,
                    position_10_label: labels?.position_10_label || null,
                }
            })

        // ------------------------------------------------------------------
        // BUILD CONTEXT
        // ------------------------------------------------------------------
        const context: SessionContext = {
            session: {
                contractTypeKey: passedContext?.contractTypeKey || (sessionRow.contract_type_key as string) || null,
                contractType: (cr?.service_required as string) || 'Service Agreement',
                currentPhase,
                phaseName: PHASE_NAMES[currentPhase] || 'Active Negotiation',
                dealValue: (cr?.deal_value as number) || 0,
                currency: (sessionRow.currency as string) || 'GBP',
                industry: (cr?.industry as string) || 'Not specified',
                status: (sessionRow.status as string) || 'active',
                sessionNumber: (sessionRow.session_number as string) || sessionId.substring(0, 8),
                initiatorPartyRole: passedContext?.initiatorPartyRole || (sessionRow.initiator_party_role as string) || null,
            },
            viewer: {
                role: viewerRole,
                company: viewerRole === 'customer' ? customerCompany : providerCompany,
                name: viewerRole === 'customer' ? customerName : providerName,
            },
            parties: {
                customer: { companyName: customerCompany, name: customerName, email: customerEmail },
                provider: { companyName: providerCompany, name: providerName, email: providerEmail },
            },
            leverage: {
                tracker: { customer: leverageTrackerCustomer, provider: leverageTrackerProvider },
                leverageBalance,
                factors: leverageFactors,
            },
            positions: {
                total,
                agreed,
                aligned,
                disputed,
                alignmentPercentage: passedContext?.alignmentScore ?? alignmentPercentage,
                averageGapSize,
                biggestGaps,
            },
            recentHistory: {
                lastMoves,
                recentChatMessages,
            },
            partyChat,
            clauseContext,
            playbook: {
                hasPlaybook: !!playbookData,
                playbookName: playbookData?.playbook_name || null,
                totalRules: playbookRules.length,
                activeRules: playbookRules,
                activeAlerts: [],
            },
            touchpoint: {
                userMessage,
            },
            mode: {
                isTraining,
                trainingOpponentType,
                opponentPersonality,
            },
            strategicInsights: {
                customerPriorities: (cr as Record<string, unknown>)?.priorities || (cr as Record<string, unknown>)?.key_priorities || null,
                customerRedLines: (cr as Record<string, unknown>)?.red_lines || (cr as Record<string, unknown>)?.deal_breakers || null,
                providerPriorities: (pb as Record<string, unknown>)?.provider_priorities || (pb as Record<string, unknown>)?.key_priorities || null,
                providerFlexibility: (pb as Record<string, unknown>)?.flexibility_areas || (pb as Record<string, unknown>)?.negotiation_flexibility || null,
            },
        }

        console.log('[ContextBuilder] Built context in', Date.now() - start, 'ms')
        console.log('[ContextBuilder] Session:', sessionRow.session_number, '| Clauses:', total, '| Alignment:', alignmentPercentage + '%')
        console.log('[ContextBuilder] Party chat:', partyChat.length, '| Position history:', lastMoves.length, '| Playbook:', !!playbookData, '| Clause context:', !!clauseContext)

        return { success: true, context, buildTime: Date.now() - start }

    } catch (error) {
        console.error('[ContextBuilder] Failed:', error)
        return { success: false, context: null, buildTime: Date.now() - start }
    }
}
