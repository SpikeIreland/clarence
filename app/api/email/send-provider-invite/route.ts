// ============================================================================
// API ROUTE: /api/email/send-provider-invite
// Called by N8N to send provider invitation emails via Resend
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

interface ProviderInviteRequest {
    providerEmail: string
    providerContact: string
    providerCompany: string
    customerCompany: string
    serviceRequired: string
    sessionNumber: string
    dealValue?: string
    inviteUrl: string
    inviteToken: string
}

// ============================================================================
// SECTION 2: EMAIL TEMPLATE
// ============================================================================

function generateEmailHtml(data: ProviderInviteRequest): string {
    const dealValueHtml = data.dealValue
        ? `<p style="margin: 0;"><strong>Estimated Value:</strong> £${Number(data.dealValue).toLocaleString()}</p>`
        : ''

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #334155; margin: 0; font-size: 28px; font-weight: 500;">CLARENCE</h1>
            <p style="color: #64748b; font-size: 11px; letter-spacing: 3px; margin: 5px 0 0; text-transform: uppercase;">The Honest Broker</p>
        </div>

        <!-- Main Card -->
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <p style="color: #334155; font-size: 16px; margin: 0 0 20px;">Dear ${data.providerContact},</p>
            
            <p style="color: #334155; font-size: 16px; margin: 0 0 20px;">
                You have been invited by <strong>${data.customerCompany}</strong> to participate in a contract negotiation.
            </p>

            <!-- Details Box -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 10px;"><strong>Service:</strong> ${data.serviceRequired || 'Contract Services'}</p>
                <p style="margin: 0 0 10px;"><strong>Session Reference:</strong> ${data.sessionNumber}</p>
                ${dealValueHtml}
            </div>

            <p style="color: #334155; font-size: 15px; margin: 0 0 20px;">
                CLARENCE is an AI-powered contract mediation platform that facilitates transparent, 
                data-driven negotiations between customers and providers.
            </p>

            <p style="color: #334155; font-size: 15px; margin: 0 0 24px;">
                Click the button below to review the contract details and submit your position.
            </p>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="${data.inviteUrl}" 
                   style="display: inline-block; background: linear-gradient(to right, #3b82f6, #2563eb); 
                          color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; 
                          font-weight: 600; font-size: 16px;">
                    Review Invitation →
                </a>
            </div>

            <p style="color: #64748b; font-size: 14px; margin: 24px 0 0;">
                If you have any questions, please contact ${data.customerCompany} directly or reach out to our support team.
            </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                This invitation was sent via CLARENCE - The Honest Broker
            </p>
            <p style="color: #94a3b8; font-size: 12px; margin: 5px 0 0;">
                © 2026 Spike Island Studios. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
`
}

// ============================================================================
// SECTION 3: API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        // Initialize Resend inside handler (not at module level)
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)

        const body = await request.json()

        // Validate required fields
        const {
            providerEmail,
            providerContact,
            providerCompany,
            customerCompany,
            serviceRequired,
            sessionNumber,
            dealValue,
            inviteUrl,
            inviteToken
        } = body

        if (!providerEmail) {
            return NextResponse.json(
                { success: false, error: 'Provider email is required' },
                { status: 400 }
            )
        }

        if (!inviteUrl) {
            return NextResponse.json(
                { success: false, error: 'Invite URL is required' },
                { status: 400 }
            )
        }

        // Prepare email data
        const emailData: ProviderInviteRequest = {
            providerEmail,
            providerContact: providerContact || providerCompany || 'Provider',
            providerCompany: providerCompany || 'Your Company',
            customerCompany: customerCompany || 'Customer',
            serviceRequired: serviceRequired || 'Contract Services',
            sessionNumber: sessionNumber || '',
            dealValue: dealValue || '',
            inviteUrl,
            inviteToken: inviteToken || ''
        }

        // Generate email HTML
        const htmlContent = generateEmailHtml(emailData)

        // Send via Resend
        const { data, error } = await resend.emails.send({
            from: 'CLARENCE <support@clarencelegal.ai>',
            to: [providerEmail],
            subject: `Contract Invitation: ${emailData.serviceRequired} - ${emailData.customerCompany}`,
            html: htmlContent
        })

        if (error) {
            console.error('Resend error:', error)
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            )
        }

        console.log('Provider invite email sent:', {
            to: providerEmail,
            messageId: data?.id,
            session: sessionNumber
        })

        return NextResponse.json({
            success: true,
            message: 'Invitation email sent successfully',
            messageId: data?.id,
            recipient: providerEmail
        })

    } catch (err) {
        console.error('Error sending provider invite:', err)
        return NextResponse.json(
            { success: false, error: 'Failed to send invitation email' },
            { status: 500 }
        )
    }
}

// ============================================================================
// SECTION 4: CORS HANDLING
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