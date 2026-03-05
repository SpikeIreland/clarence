// ============================================================================
// API ROUTE: /api/email/send-approval-request
// Sends approval request emails to internal approvers via Resend
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

interface ApprovalEmailRequest {
    approverEmail: string
    approverName: string
    requesterName: string
    requesterEmail: string
    requesterCompany: string
    documentName: string
    documentType: string
    contractName: string
    message?: string
    priority: 'normal' | 'high' | 'urgent'
    approvalUrl: string
}

// ============================================================================
// SECTION 2: EMAIL TEMPLATE
// ============================================================================

function generateApprovalEmailHtml(data: ApprovalEmailRequest): string {
    const priorityBadge = data.priority !== 'normal'
        ? `<span style="display: inline-block; background: ${data.priority === 'urgent' ? '#dc2626' : '#f59e0b'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-left: 8px;">${data.priority}</span>`
        : ''

    const messageBlock = data.message
        ? `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
               <p style="color: #166534; font-size: 13px; font-weight: 600; margin: 0 0 6px;">Message from ${data.requesterName}:</p>
               <p style="color: #334155; font-size: 14px; margin: 0; font-style: italic;">"${data.message}"</p>
           </div>`
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
            <p style="color: #334155; font-size: 16px; margin: 0 0 20px;">Dear ${data.approverName},</p>

            <p style="color: #334155; font-size: 16px; margin: 0 0 20px;">
                <strong>${data.requesterName}</strong> from <strong>${data.requesterCompany}</strong> has requested your approval on a document.${priorityBadge}
            </p>

            <!-- Document Details -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 10px;"><strong>Document:</strong> ${data.documentName}</p>
                <p style="margin: 0 0 10px;"><strong>Contract:</strong> ${data.contractName}</p>
                <p style="margin: 0;"><strong>Type:</strong> ${data.documentType}</p>
            </div>

            ${messageBlock}

            <p style="color: #334155; font-size: 15px; margin: 0 0 24px;">
                Please review the document and provide your approval or feedback by clicking the button below.
            </p>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="${data.approvalUrl}"
                   style="display: inline-block; background: linear-gradient(to right, #059669, #10b981);
                          color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px;
                          font-weight: 600; font-size: 16px;">
                    Review &amp; Approve →
                </a>
            </div>

            <p style="color: #64748b; font-size: 14px; margin: 24px 0 0;">
                If you have questions about this document, please contact ${data.requesterName} at ${data.requesterEmail}.
            </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                This approval request was sent via CLARENCE - The Honest Broker
            </p>
            <p style="color: #94a3b8; font-size: 12px; margin: 5px 0 0;">
                &copy; 2026 Spike Island Studios. All rights reserved.
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
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)

        const body = await request.json()

        const {
            approverEmail,
            approverName,
            requesterName,
            requesterEmail,
            requesterCompany,
            documentName,
            documentType,
            contractName,
            message,
            priority,
            approvalUrl,
        } = body

        if (!approverEmail || !approvalUrl) {
            return NextResponse.json(
                { success: false, error: 'Approver email and approval URL are required' },
                { status: 400 }
            )
        }

        const emailData: ApprovalEmailRequest = {
            approverEmail,
            approverName: approverName || 'Approver',
            requesterName: requesterName || 'Requester',
            requesterEmail: requesterEmail || '',
            requesterCompany: requesterCompany || 'Company',
            documentName: documentName || 'Document',
            documentType: documentType || 'Contract Document',
            contractName: contractName || 'Contract',
            message: message || '',
            priority: priority || 'normal',
            approvalUrl,
        }

        const htmlContent = generateApprovalEmailHtml(emailData)

        const priorityPrefix = priority === 'urgent' ? '[URGENT] ' : priority === 'high' ? '[HIGH] ' : ''

        const { data, error } = await resend.emails.send({
            from: 'CLARENCE <support@clarencelegal.ai>',
            to: [approverEmail],
            subject: `${priorityPrefix}Approval Required: ${emailData.documentName} - ${emailData.contractName}`,
            html: htmlContent,
        })

        if (error) {
            console.error('Resend error (approval):', error)
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            )
        }

        console.log('Approval request email sent:', {
            to: approverEmail,
            messageId: data?.id,
            document: documentName,
        })

        return NextResponse.json({
            success: true,
            message: 'Approval request email sent',
            messageId: data?.id,
            recipient: approverEmail,
        })

    } catch (err) {
        console.error('Error sending approval email:', err)
        return NextResponse.json(
            { success: false, error: 'Failed to send approval request email' },
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
