'use client'

// ============================================================================
// TRAINING PLAYBOOK COMPLIANCE
// Location: app/auth/contract-studio/components/TrainingPlaybookCompliance.tsx
//
// Self-contained component that loads playbook data for the current training
// session and renders the PlaybookComplianceIndicator with live recalculation.
// Only renders for playbook training sessions — returns null for scenario/template.
// ============================================================================

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
    calculatePlaybookCompliance,
    type PlaybookRule,
    type ContractClause as ComplianceClause,
    type ComplianceResult,
} from '@/lib/playbook-compliance'
import PlaybookComplianceIndicator from '@/app/components/PlaybookComplianceIndicator'

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================

// Contract Studio clause shape (subset of fields we need)
interface StudioClause {
    clauseId: string
    clauseName: string
    category: string
    customerPosition: number | null
    providerPosition: number | null
    clarenceRecommendation: number | null
    isCategoryHeader?: boolean
}

interface TrainingPlaybookComplianceProps {
    sessionId: string
    clauses: StudioClause[]
}

// ============================================================================
// SECTION 2: CLAUSE ADAPTER
// ============================================================================

function toComplianceClauses(clauses: StudioClause[]): ComplianceClause[] {
    return clauses
        .filter(c => !c.isCategoryHeader)
        .map(c => ({
            clause_id: c.clauseId,
            clause_name: c.clauseName,
            category: c.category,
            clarence_position: c.clarenceRecommendation,
            initiator_position: c.customerPosition,
            respondent_position: c.providerPosition,
            customer_position: c.customerPosition,
            is_header: false,
        }))
}

// ============================================================================
// SECTION 3: MAIN COMPONENT
// ============================================================================

export default function TrainingPlaybookCompliance({
    sessionId,
    clauses,
}: TrainingPlaybookComplianceProps) {
    const supabase = createClient()

    const [playbookRules, setPlaybookRules] = useState<PlaybookRule[] | null>(null)
    const [playbookName, setPlaybookName] = useState<string>('')
    const [companyName, setCompanyName] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [hasPlaybook, setHasPlaybook] = useState(false)

    // Load playbook data on mount
    useEffect(() => {
        async function loadPlaybookData() {
            try {
                // 1. Check if this is a playbook training session
                const { data: trainingSession, error: tsError } = await supabase
                    .from('playbook_training_sessions')
                    .select('playbook_id')
                    .eq('session_id', sessionId)
                    .single()

                if (tsError || !trainingSession?.playbook_id) {
                    // Not a playbook training session — this is expected for scenario/template training
                    setHasPlaybook(false)
                    setLoading(false)
                    return
                }

                setHasPlaybook(true)
                const playbookId = trainingSession.playbook_id

                // 2. Load playbook rules
                const { data: rules, error: rulesError } = await supabase
                    .from('playbook_rules')
                    .select('*')
                    .eq('playbook_id', playbookId)
                    .eq('is_active', true)

                if (rulesError) {
                    console.error('Error loading playbook rules:', rulesError)
                    setLoading(false)
                    return
                }

                // 3. Get playbook name for display
                const { data: playbook } = await supabase
                    .from('company_playbooks')
                    .select('playbook_name, company_id')
                    .eq('playbook_id', playbookId)
                    .single()

                if (playbook) {
                    setPlaybookName(playbook.playbook_name || 'Company Playbook')

                    // Get company name
                    const { data: company } = await supabase
                        .from('companies')
                        .select('company_name')
                        .eq('company_id', playbook.company_id)
                        .single()

                    setCompanyName(company?.company_name || '')
                }

                setPlaybookRules(rules as PlaybookRule[])
            } catch (err) {
                console.error('Error loading playbook compliance data:', err)
            } finally {
                setLoading(false)
            }
        }

        loadPlaybookData()
    }, [sessionId, supabase])

    // Recalculate compliance live as positions change
    const compliance: ComplianceResult | null = useMemo(() => {
        if (!playbookRules || playbookRules.length === 0) return null
        const adaptedClauses = toComplianceClauses(clauses)
        return calculatePlaybookCompliance(playbookRules, adaptedClauses)
    }, [playbookRules, clauses])

    // Don't render if not a playbook training session
    if (!hasPlaybook || loading || !compliance) return null

    return (
        <div className="p-2">
            <PlaybookComplianceIndicator
                compliance={compliance}
                playbookName={playbookName}
                companyName={companyName}
            />
        </div>
    )
}
