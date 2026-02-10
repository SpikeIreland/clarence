// ============================================================================
// FILE: app/api/n8n/clarence-chat/route.ts
// PURPOSE: API route for Quick Contract Studio CLARENCE chat
// VERSION: 2.0 - With Context Builder Integration
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

interface ClarenceChatRequest {
    message: string
    contractId?: string
    clauseId?: string
    clauseName?: string
    clauseCategory?: string
    context?: string
    // NEW: Context builder fields
    viewerRole?: 'initiator' | 'respondent'
    viewerUserId?: string
    viewerCompanyId?: string
}

// ============================================================================
// SECTION 2: WEBHOOK CONFIGURATION
// ============================================================================

const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL
    || 'https://spikeislandstudios.app.n8n.cloud'

const CHAT_WEBHOOK = `${N8N_BASE_URL}/webhook/clarence-qc-chat`
const CONTEXT_WEBHOOK = `${N8N_BASE_URL}/webhook/clarence-qc-context-builder`

// ============================================================================
// SECTION 3: POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
    console.log('=== CLARENCE QC CHAT API v2.0 ===')

    try {
        const body: ClarenceChatRequest = await request.json()

        console.log('Contract:', body.contractId)
        console.log('Viewer Role:', body.viewerRole)
        console.log('Context Type:', body.context)
        console.log('Clause:', body.clauseName)
        console.log('Message preview:', body.message?.substring(0, 100))

        if (!body.message) {
            return NextResponse.json(
                { error: 'Message is required', success: false },
                { status: 400 }
            )
        }

        // ================================================================
        // STEP 1: Build Context (if contractId provided)
        // ================================================================
        let qcContext = null

        if (body.contractId && body.viewerRole) {
            console.log('Building QC context...')
            try {
                const contextResponse = await fetch(CONTEXT_WEBHOOK, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contractId: body.contractId,
                        viewerRole: body.viewerRole,
                        viewerUserId: body.viewerUserId || '',
                        viewerCompanyId: body.viewerCompanyId || '',
                        clauseId: body.clauseId || '',
                        touchpointType: body.context || 'qc_chat',
                        touchpointContext: {
                            userMessage: body.message,
                            clauseId: body.clauseId
                        }
                    })
                })

                if (contextResponse.ok) {
                    qcContext = await contextResponse.json()
                    console.log('Context built successfully')
                    console.log('- Contract:', qcContext.contract?.contractName)
                    console.log('- Clauses:', qcContext.statistics?.totalClauses)
                    console.log('- Activity events:', qcContext.recentActivity?.length)
                    console.log('- Party chat:', qcContext.partyChat?.length)
                } else {
                    console.warn('Context builder returned non-OK:', contextResponse.status)
                }
            } catch (contextError) {
                console.error('Context builder error (continuing without context):', contextError)
            }
        }

        // ================================================================
        // STEP 2: Call Chat Workflow with Context
        // ================================================================
        console.log('Calling chat workflow...')

        const n8nResponse = await fetch(CHAT_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: body.message,
                contractId: body.contractId || null,
                clauseId: body.clauseId || null,
                clauseName: body.clauseName || null,
                clauseCategory: body.clauseCategory || null,
                context: body.context || 'quick_contract_studio',
                viewerRole: body.viewerRole || null,
                // Pass the full context to the workflow
                qcContext: qcContext
            })
        })

        console.log('Chat response status:', n8nResponse.status)

        if (!n8nResponse.ok) {
            const errorText = await n8nResponse.text()
            console.error('Chat webhook error:', n8nResponse.status, errorText)
            return NextResponse.json(
                {
                    error: 'Failed to get response from CLARENCE',
                    success: false,
                    response: 'I apologize, but I encountered an issue connecting to the service. Please try again.'
                },
                { status: 502 }
            )
        }

        const data = await n8nResponse.json()
        console.log('Response received, length:', (data.response || data.message || '').length)

        return NextResponse.json({
            response: data.response || data.message || data.text || '',
            message: data.response || data.message || data.text || '',
            success: true
        })

    } catch (error) {
        console.error('Clarence chat API error:', error)
        return NextResponse.json(
            {
                error: 'Internal server error',
                success: false,
                response: 'I apologize, but I encountered an unexpected error. Please try again.'
            },
            { status: 500 }
        )
    }
}

// ============================================================================
// SECTION 4: OPTIONS HANDLER (CORS)
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