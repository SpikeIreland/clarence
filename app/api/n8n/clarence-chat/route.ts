// ============================================================================
// FILE: app/api/n8n/clarence-chat/route.ts
// PURPOSE: Unified API route for ALL CLARENCE chat touchpoints
// VERSION: 5.0 - Session path now calls Claude directly (bypasses broken n8n
//                Build Context sub-workflow). QC path unchanged.
//
// CHANGES in v5.0:
// - Session path: build context server-side → call Claude API directly
//   (fixes "Workflow does not exist" error from n8n Build Context node)
// - Removed SESSION_CHAT_WEBHOOK dependency
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getRoleContext, type PartyRole } from '@/lib/role-matrix'
import Anthropic from '@anthropic-ai/sdk'
import { buildSessionContext } from '@/lib/session-context-builder'
import { buildSessionPrompts } from '@/lib/session-prompt-builder'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

interface ClarenceChatRequest {
    message: string
    contractId?: string
    sessionId?: string
    clauseId?: string
    clauseName?: string
    clauseCategory?: string
    context?: string
    // Context builder fields
    viewerRole?: 'initiator' | 'respondent' | 'customer' | 'provider'
    viewerUserId?: string
    viewerCompanyId?: string
    // Role matrix fields — enables contract-type-specific party labels
    contractTypeKey?: string
    initiatorPartyRole?: PartyRole
    // Dashboard-specific fields
    dashboardData?: Record<string, unknown>
    // Session-based fields (Contract Studio, Chat page)
    providerId?: string
    currentPhase?: number
    alignmentScore?: number
    negotiationContext?: Record<string, unknown>
    // Assessment fields
    action?: string
    type?: string
    prompt?: string
}

// ============================================================================
// SECTION 2: WEBHOOK CONFIGURATION
// ============================================================================

const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL
    || 'https://spikeislandstudios.app.n8n.cloud'

// QC Studio path: contract-based, uses QC context builder (still via n8n)
const QC_CHAT_WEBHOOK = `${N8N_BASE_URL}/webhook/clarence-qc-chat`
const QC_CONTEXT_WEBHOOK = `${N8N_BASE_URL}/webhook/clarence-qc-context-builder`

// Session path: Claude model config (matches n8n workflow)
const SESSION_MODEL = 'claude-sonnet-4-20250514'
const SESSION_MAX_TOKENS = 1500

// ============================================================================
// SECTION 3: POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        const body: ClarenceChatRequest = await request.json()

        // ================================================================
        // STEP 0: Detect routing path
        // ================================================================
        // Contract Studio sends sessionId (no contractId)
        // QC Studio sends contractId (no sessionId)
        // Dashboard sends neither (general mode)
        const isSessionPath = !!(body.sessionId && !body.contractId)
        const isQCPath = !!body.contractId

        console.log(`=== CLARENCE CHAT API v4.0 [${isSessionPath ? 'SESSION' : isQCPath ? 'QC' : 'GENERAL'}] ===`)
        console.log('Contract:', body.contractId)
        console.log('Session:', body.sessionId)
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
        // SESSION PATH: Contract Studio → Direct Claude API call
        // (Replaces broken n8n clarence-chat workflow whose Build Context
        //  sub-workflow was never created)
        // ================================================================
        if (isSessionPath) {
            console.log('Routing to SESSION path (direct Claude API)')

            // Map viewerRole to customer/provider
            let sessionViewerRole: 'customer' | 'provider' = (body.viewerRole as 'customer' | 'provider') || 'customer'
            if (body.viewerRole === 'initiator') sessionViewerRole = 'customer'
            if (body.viewerRole === 'respondent') sessionViewerRole = 'provider'

            // Derive roleContext server-side for prompt builder
            let sessionRoleContext = null
            if (body.contractTypeKey && body.initiatorPartyRole) {
                const isInitiator = sessionViewerRole === 'customer'
                sessionRoleContext = getRoleContext(
                    body.contractTypeKey,
                    body.initiatorPartyRole as PartyRole,
                    isInitiator
                )
                console.log('Session role context derived:', sessionRoleContext.userRoleLabel, 'vs', sessionRoleContext.counterpartyRoleLabel)
            }

            // STEP 1: Build context from Supabase
            const contextResult = await buildSessionContext(
                body.sessionId!,
                sessionViewerRole,
                body.message,
                {
                    contractTypeKey: body.contractTypeKey || null,
                    initiatorPartyRole: body.initiatorPartyRole as string || null,
                    clauseId: body.clauseId || null,
                    clauseName: body.clauseName || null,
                    alignmentScore: body.alignmentScore || null,
                    viewerCompanyId: body.viewerCompanyId || null,
                }
            )

            if (!contextResult.success || !contextResult.context) {
                console.error('Session context build failed')
                return NextResponse.json(
                    {
                        error: 'Failed to build negotiation context',
                        success: false,
                        response: 'I apologize, but I could not load the negotiation context. Please refresh and try again.'
                    },
                    { status: 502 }
                )
            }

            // STEP 2: Build prompts
            let systemPrompt: string
            let userPrompt: string
            try {
                const prompts = buildSessionPrompts(
                    contextResult.context,
                    sessionRoleContext
                )
                systemPrompt = prompts.systemPrompt
                userPrompt = prompts.userPrompt
                console.log('Session prompt built, system:', systemPrompt.length, 'chars, user:', userPrompt.length, 'chars')
            } catch (promptError) {
                console.error('Session prompt build failed:', promptError)
                return NextResponse.json(
                    {
                        error: 'Failed to build prompt',
                        success: false,
                        response: 'I apologize, but I could not prepare the AI request. Please try again.',
                        debug: String(promptError)
                    },
                    { status: 500 }
                )
            }

            // STEP 3: Call Claude API directly
            const apiKey = process.env.ANTHROPIC_API_KEY
            if (!apiKey) {
                console.error('ANTHROPIC_API_KEY not set')
                return NextResponse.json(
                    {
                        error: 'CLARENCE AI service not configured',
                        success: false,
                        response: 'I apologize, but the AI service is not configured. Please contact support.'
                    },
                    { status: 503 }
                )
            }

            try {
                const anthropic = new Anthropic({ apiKey })
                const claudeResponse = await anthropic.messages.create({
                    model: SESSION_MODEL,
                    max_tokens: SESSION_MAX_TOKENS,
                    temperature: 0,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: userPrompt }],
                })

                const responseText = claudeResponse.content
                    .filter(block => block.type === 'text')
                    .map(block => block.type === 'text' ? block.text : '')
                    .join('')

                console.log('Session Claude response received, length:', responseText.length, 'tokens:', claudeResponse.usage?.output_tokens)

                return NextResponse.json({
                    response: responseText,
                    message: responseText,
                    success: true,
                    _debug: {
                        clauseContextFound: !!contextResult.context?.clauseContext,
                        clauseIdSent: body.clauseId || null,
                        clauseNameSent: body.clauseName || null,
                        buildTime: contextResult.buildTime,
                    }
                })
            } catch (claudeError) {
                console.error('Claude API call failed:', claudeError)
                const errMsg = claudeError instanceof Error ? claudeError.message : String(claudeError)
                return NextResponse.json(
                    {
                        error: 'Claude API call failed',
                        success: false,
                        response: 'I apologize, but I could not connect to the AI service. Please try again.',
                        debug: errMsg
                    },
                    { status: 502 }
                )
            }
        }

        // ================================================================
        // QC PATH: QC Studio → clarence-qc-chat workflow
        // ================================================================

        // STEP 1: Derive Role Context (server-side)
        let roleContext = null
        if (body.contractTypeKey && body.initiatorPartyRole && body.viewerRole) {
            const isInitiator = body.viewerRole === 'initiator'
            roleContext = getRoleContext(
                body.contractTypeKey,
                body.initiatorPartyRole,
                isInitiator
            )
            console.log('Role context derived:', roleContext.userRoleLabel, 'vs', roleContext.counterpartyRoleLabel)
        }

        // STEP 1b: Agent fallback for ambiguous/missing role data
        if (!roleContext && body.sessionId) {
            try {
                const { resolveRoles } = await import('@/lib/agents/role-resolver')
                const resolved = await resolveRoles({
                    sessionId: body.sessionId,
                    contractTypeKey: body.contractTypeKey || null,
                    initiatorPartyRole: body.initiatorPartyRole || null,
                    viewerRole: body.viewerRole,
                    contractDescription: body.context || null,
                })
                roleContext = resolved
                console.log('Role context resolved by agent:', resolved.resolvedBy, resolved.confidence)
            } catch (agentError) {
                console.warn('Role resolver agent failed, continuing without role context:', agentError)
            }
        }

        // STEP 2: Build QC Context (if contractId provided)
        let qcContext = null

        if (body.contractId && body.viewerRole) {
            console.log('Building QC context...')
            try {
                const contextResponse = await fetch(QC_CONTEXT_WEBHOOK, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contractId: body.contractId,
                        viewerRole: body.viewerRole,
                        viewerUserId: body.viewerUserId || '',
                        viewerCompanyId: body.viewerCompanyId || '',
                        clauseId: body.clauseId || '',
                        touchpointType: body.context || 'qc_chat',
                        contractTypeKey: body.contractTypeKey || '',
                        initiatorPartyRole: body.initiatorPartyRole || '',
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

        // STEP 3: Call QC Chat Workflow
        console.log('Routing to QC workflow (clarence-qc-chat)')

        const n8nResponse = await fetch(QC_CHAT_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: body.message,
                contractId: body.contractId || null,
                sessionId: body.sessionId || null,
                clauseId: body.clauseId || null,
                clauseName: body.clauseName || null,
                clauseCategory: body.clauseCategory || null,
                context: body.context || 'quick_contract_studio',
                viewerRole: body.viewerRole || null,
                roleContext: roleContext,
                contractTypeKey: body.contractTypeKey || null,
                initiatorPartyRole: body.initiatorPartyRole || null,
                qcContext: qcContext,
                providerId: body.providerId || null,
                currentPhase: body.currentPhase || null,
                alignmentScore: body.alignmentScore || null,
                negotiationContext: body.negotiationContext || null,
                dashboardData: body.dashboardData || null,
                action: body.action || null,
                type: body.type || null,
                prompt: body.prompt || null,
            })
        })

        console.log('QC chat response status:', n8nResponse.status)

        if (!n8nResponse.ok) {
            const errorText = await n8nResponse.text()
            console.error('QC chat webhook error:', n8nResponse.status, errorText)
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
        if (roleContext) {
            console.log('Response was generated with role context:', roleContext.userRoleLabel, '(viewer)')
        }

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
