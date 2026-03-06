// ============================================================================
// API ROUTE: /api/approval/request
// Creates a DoA approval request (clause or contract) from QC Studio.
// Finds the company's designated approver, creates DB records, sends email.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================================
// SECTION 1: SERVICE CLIENT
// ============================================================================

function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// ============================================================================
// SECTION 2: POST — Create approval request
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            contractId,
            sessionId,
            requestCategory,   // 'clause' | 'contract'
            clauseId,
            clauseName,
            documentName,
            message,
            priority = 'normal',
            approvalContext,
            requesterUserId,
            requesterName,
            requesterEmail,
            requesterCompany,
            companyId,
        } = body

        // Basic validation
        if (!contractId || !requestCategory || !requesterUserId || !companyId) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: contractId, requestCategory, requesterUserId, companyId' },
                { status: 400 }
            )
        }

        if (!['clause', 'contract'].includes(requestCategory)) {
            return NextResponse.json(
                { success: false, error: 'requestCategory must be "clause" or "contract"' },
                { status: 400 }
            )
        }

        const supabase = getServiceClient()

        // ====================================================================
        // Find designated approver for this company
        // ====================================================================
        const { data: approvers, error: approverError } = await supabase
            .from('company_users')
            .select('user_id, approval_role')
            .eq('company_id', companyId)
            .in('approval_role', ['approver', 'admin'])
            .eq('status', 'active')
            .limit(5)

        if (approverError) {
            console.error('Error fetching approvers:', approverError)
            return NextResponse.json(
                { success: false, error: 'Failed to find approvers' },
                { status: 500 }
            )
        }

        if (!approvers || approvers.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No approvers are configured for your company. Ask your administrator to designate an approver in Company Settings.' },
                { status: 422 }
            )
        }

        // Pick first approver (Phase 1 — single approver)
        const approverUserId = approvers[0].user_id

        // Fetch approver's name and email from users table
        const { data: approverUser } = await supabase
            .from('users')
            .select('first_name, last_name, email')
            .eq('user_id', approverUserId)
            .single()

        if (!approverUser) {
            return NextResponse.json(
                { success: false, error: 'Could not fetch approver details' },
                { status: 500 }
            )
        }

        const approverName = `${approverUser.first_name || ''} ${approverUser.last_name || ''}`.trim() || 'Approver'
        const approverEmail = approverUser.email

        // ====================================================================
        // Create the approval request
        // ====================================================================
        const { data: requestRow, error: insertError } = await supabase
            .from('internal_approval_requests')
            .insert({
                contract_id: contractId,
                session_id: sessionId || null,
                source_type: 'quick_contract',
                request_category: requestCategory,
                clause_id: clauseId || null,
                clause_name: clauseName || null,
                document_type: requestCategory,
                document_name: documentName || (requestCategory === 'contract' ? 'Full Contract' : clauseName || 'Clause'),
                document_url: null,
                requested_by_user_id: requesterUserId,
                requested_by_name: requesterName || '',
                requested_by_email: requesterEmail || '',
                message: message || null,
                priority,
                requires_all_approvers: true,
                status: 'pending',
                approval_context: approvalContext || null,
            })
            .select('request_id')
            .single()

        if (insertError || !requestRow) {
            console.error('Error creating approval request:', insertError)
            return NextResponse.json(
                { success: false, error: 'Failed to create approval request' },
                { status: 500 }
            )
        }

        // ====================================================================
        // Create the approver response row with unique token
        // ====================================================================
        const accessToken = crypto.randomUUID()

        const { error: responseInsertError } = await supabase
            .from('internal_approval_responses')
            .insert({
                request_id: requestRow.request_id,
                approver_email: approverEmail,
                approver_name: approverName,
                approver_user_id: approverUserId,
                access_token: accessToken,
                status: 'pending',
            })

        if (responseInsertError) {
            console.error('Error creating approver response row:', responseInsertError)
            return NextResponse.json(
                { success: false, error: 'Failed to register approver' },
                { status: 500 }
            )
        }

        // ====================================================================
        // Send approval request email
        // ====================================================================
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000'

        const approvalUrl = `${process.env.NEXT_PUBLIC_APP_URL || baseUrl}/approval/${accessToken}`

        // Build a category-appropriate document name for the email subject
        const emailDocumentName = requestCategory === 'clause'
            ? `Clause: ${clauseName || documentName}`
            : `Contract Sign-off: ${documentName}`

        try {
            const emailRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || baseUrl}/api/email/send-approval-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    approverEmail,
                    approverName,
                    requesterName,
                    requesterEmail,
                    requesterCompany: requesterCompany || '',
                    documentName: emailDocumentName,
                    documentType: requestCategory === 'clause' ? 'Clause Approval' : 'Contract Sign-off',
                    contractName: documentName || 'Contract',
                    message,
                    priority,
                    approvalUrl,
                }),
            })

            if (emailRes.ok) {
                // Mark as sent
                await supabase
                    .from('internal_approval_responses')
                    .update({ status: 'sent', sent_at: new Date().toISOString() })
                    .eq('access_token', accessToken)
            }
        } catch (emailErr) {
            // Non-fatal — request is created, email failure is logged
            console.error('Failed to send approval email:', emailErr)
        }

        return NextResponse.json({
            success: true,
            requestId: requestRow.request_id,
            approverName,
            approverEmail,
            category: requestCategory,
        })

    } catch (err) {
        console.error('Error in /api/approval/request:', err)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// ============================================================================
// SECTION 3: CORS
// ============================================================================

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    })
}
