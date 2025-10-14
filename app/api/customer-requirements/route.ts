// =====================================================
// SECTION 1: API ROUTE HANDLER
// Handles form submissions and forwards to N8N webhook
// =====================================================

import { NextRequest, NextResponse } from 'next/server'

const WEBHOOK_URL = 'https://spikeislandstudios.app.n8n.cloud/webhook/customer-requirements'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json()
    
    console.log('📥 Received customer requirements submission')
    
    // Forward to N8N webhook
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    })

    if (!response.ok) {
      throw new Error(`N8N webhook failed: ${response.status}`)
    }

    const result = await response.json()
    
    console.log('✅ N8N processed successfully:', result.session_id)
    
    return NextResponse.json({
      success: true,
      sessionId: result.session_id,
      message: 'Requirements submitted successfully'
    })
    
  } catch (error) {
    console.error('❌ API route error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to submit requirements' 
      },
      { status: 500 }
    )
  }
}