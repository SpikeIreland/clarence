// ============================================================================
// API ROUTE: /api/approval/respond
// Used by public approver page to submit approve/reject decisions.
// Uses service role key since approvers access via token (not Supabase auth).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================================
// SECTION 1: SERVICE ROLE CLIENT
// ============================================================================

function getServiceClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    return createClient(supabaseUrl, serviceRoleKey)
}

// ============================================================================
// SECTION 2: API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { access_token, decision, decision_note } = body

        if (!access_token) {
            return NextResponse.json(
                { success: false, error: 'Access token is required' },
                { status: 400 }
            )
        }

        if (!decision || !['approved', 'rejected'].includes(decision)) {
            return NextResponse.json(
                { success: false, error: 'Decision must be "approved" or "rejected"' },
                { status: 400 }
            )
        }

        const supabase = getServiceClient()

        // Look up the response row by access token
        const { data: responseRow, error: lookupError } = await supabase
            .from('internal_approval_responses')
            .select('*, internal_approval_requests(*)')
            .eq('access_token', access_token)
            .single()

        if (lookupError || !responseRow) {
            return NextResponse.json(
                { success: false, error: 'Invalid or expired approval link' },
                { status: 404 }
            )
        }

        // Check if already responded
        if (responseRow.status === 'approved' || responseRow.status === 'rejected') {
            return NextResponse.json(
                { success: false, error: 'You have already submitted your response', existing_decision: responseRow.status },
                { status: 409 }
            )
        }

        // Update the response row
        const { error: updateError } = await supabase
            .from('internal_approval_responses')
            .update({
                status: decision,
                decision_note: decision_note || null,
                responded_at: new Date().toISOString(),
                ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
                user_agent: request.headers.get('user-agent') || null,
            })
            .eq('response_id', responseRow.response_id)

        if (updateError) {
            console.error('Error updating approval response:', updateError)
            return NextResponse.json(
                { success: false, error: 'Failed to record your response' },
                { status: 500 }
            )
        }

        // Check if the parent request should be resolved
        const requestId = responseRow.request_id
        const parentRequest = responseRow.internal_approval_requests

        // Get all responses for this request
        const { data: allResponses } = await supabase
            .from('internal_approval_responses')
            .select('status')
            .eq('request_id', requestId)

        if (allResponses && parentRequest) {
            const requiresAll = parentRequest.requires_all_approvers
            const allApproved = allResponses.every((r: { status: string }) => r.status === 'approved')
            const anyApproved = allResponses.some((r: { status: string }) => r.status === 'approved')
            const anyRejected = allResponses.some((r: { status: string }) => r.status === 'rejected')
            const allResponded = allResponses.every((r: { status: string }) => r.status === 'approved' || r.status === 'rejected')

            let newRequestStatus: string | null = null

            if (requiresAll) {
                // All must approve
                if (allApproved) newRequestStatus = 'approved'
                else if (anyRejected) newRequestStatus = 'rejected'
            } else {
                // Any one approval is enough
                if (anyApproved) newRequestStatus = 'approved'
                else if (allResponded && !anyApproved) newRequestStatus = 'rejected'
            }

            if (newRequestStatus) {
                await supabase
                    .from('internal_approval_requests')
                    .update({
                        status: newRequestStatus,
                        resolved_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('request_id', requestId)
            }
        }

        return NextResponse.json({
            success: true,
            message: `Your ${decision} decision has been recorded`,
            decision,
        })

    } catch (err) {
        console.error('Error processing approval response:', err)
        return NextResponse.json(
            { success: false, error: 'Failed to process your response' },
            { status: 500 }
        )
    }
}

// ============================================================================
// SECTION 3: GET — Fetch approval details by token (for the approver page)
// ============================================================================

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const token = searchParams.get('token')

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Token is required' },
                { status: 400 }
            )
        }

        const supabase = getServiceClient()

        // Look up response and parent request
        const { data: responseRow, error } = await supabase
            .from('internal_approval_responses')
            .select('response_id, approver_name, approver_email, status, decision_note, responded_at, request_id, internal_approval_requests(request_id, document_name, document_type, document_url, requested_by_name, requested_by_email, message, priority, status, created_at)')
            .eq('access_token', token)
            .single()

        if (error || !responseRow) {
            return NextResponse.json(
                { success: false, error: 'Invalid or expired approval link' },
                { status: 404 }
            )
        }

        // Mark as viewed if still pending/sent
        if (responseRow.status === 'pending' || responseRow.status === 'sent') {
            await supabase
                .from('internal_approval_responses')
                .update({
                    status: 'viewed',
                    viewed_at: new Date().toISOString(),
                })
                .eq('response_id', responseRow.response_id)
        }

        return NextResponse.json({
            success: true,
            data: responseRow,
        })

    } catch (err) {
        console.error('Error fetching approval details:', err)
        return NextResponse.json(
            { success: false, error: 'Failed to load approval details' },
            { status: 500 }
        )
    }
}

// ============================================================================
// SECTION 4: CORS
// ============================================================================

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    })
}
