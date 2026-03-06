// ============================================================================
// API ROUTE: /api/approval/status
// Returns current approval status for a contract or specific clause.
// Used by QC Studio to show badge states and enforce the commit gate.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// ============================================================================
// GET — Fetch approval status
// Query params: contractId (required), category (optional), clauseId (optional)
// ============================================================================

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const contractId = searchParams.get('contractId')
        const category = searchParams.get('category')   // 'clause' | 'contract'
        const clauseId = searchParams.get('clauseId')

        if (!contractId) {
            return NextResponse.json(
                { success: false, error: 'contractId is required' },
                { status: 400 }
            )
        }

        const supabase = getServiceClient()

        let query = supabase
            .from('internal_approval_requests')
            .select(`
                request_id,
                request_category,
                clause_id,
                clause_name,
                document_name,
                status,
                priority,
                created_at,
                resolved_at,
                requested_by_name,
                internal_approval_responses (
                    response_id,
                    approver_name,
                    approver_email,
                    status,
                    decision_note,
                    responded_at
                )
            `)
            .eq('contract_id', contractId)
            .order('created_at', { ascending: false })

        // Filter by category if provided
        if (category) {
            query = query.eq('request_category', category)
        }

        // Filter by clauseId if provided (for clause-specific status)
        if (clauseId) {
            query = query.eq('clause_id', clauseId)
        }

        const { data: requests, error } = await query.limit(20)

        if (error) {
            console.error('Error fetching approval status:', error)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch approval status' },
                { status: 500 }
            )
        }

        if (!requests || requests.length === 0) {
            return NextResponse.json({
                success: true,
                pending: false,
                status: 'none',
                requests: [],
            })
        }

        // ====================================================================
        // Build per-clause and contract status maps for QC Studio
        // ====================================================================

        // Contract-level: find most recent contract approval request
        const contractRequest = requests.find(r => r.request_category === 'contract')
        const contractStatus = contractRequest?.status || 'none'
        const contractApproved = contractStatus === 'approved'
        const contractPending = contractStatus === 'pending'

        // Clause-level: map clauseId → status
        const clauseStatusMap: Record<string, {
            status: string
            requestId: string
            approverName: string
            decisionNote: string | null
            resolvedAt: string | null
        }> = {}

        for (const req of requests) {
            if (req.request_category === 'clause' && req.clause_id) {
                const responses = Array.isArray(req.internal_approval_responses)
                    ? req.internal_approval_responses
                    : []
                const latestResponse = responses[0] || null

                clauseStatusMap[req.clause_id] = {
                    status: req.status,
                    requestId: req.request_id,
                    approverName: latestResponse?.approver_name || '',
                    decisionNote: latestResponse?.decision_note || null,
                    resolvedAt: req.resolved_at || null,
                }
            }
        }

        // Are there any pending requests (either type)?
        const anyPending = requests.some(r => r.status === 'pending')

        return NextResponse.json({
            success: true,
            pending: anyPending,
            contract: {
                status: contractStatus,
                approved: contractApproved,
                pending: contractPending,
                requestId: contractRequest?.request_id || null,
                approverName: (() => {
                    const responses = Array.isArray(contractRequest?.internal_approval_responses)
                        ? contractRequest!.internal_approval_responses as Array<{ approver_name: string }>
                        : []
                    return responses[0]?.approver_name || null
                })(),
            },
            clauses: clauseStatusMap,
            requests: requests.map(r => ({
                requestId: r.request_id,
                category: r.request_category,
                clauseId: r.clause_id,
                clauseName: r.clause_name,
                documentName: r.document_name,
                status: r.status,
                priority: r.priority,
                createdAt: r.created_at,
                resolvedAt: r.resolved_at,
            })),
        })

    } catch (err) {
        console.error('Error in /api/approval/status:', err)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    })
}
