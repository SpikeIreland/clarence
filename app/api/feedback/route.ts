// ============================================================================
// CLARENCE Beta Feedback API Route
// ============================================================================
// File: app/api/feedback/route.ts
// Purpose: Handle feedback submission and retrieval
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================================
// SECTION 1: HELPER FUNCTION
// ============================================================================

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables')
    }

    return createClient(supabaseUrl, supabaseKey)
}

// ============================================================================
// SECTION 2: POST - SUBMIT FEEDBACK
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        // -------------------------------------------------------------------------
        // SECTION 2.1: PARSE REQUEST BODY
        // -------------------------------------------------------------------------

        const body = await request.json()

        // -------------------------------------------------------------------------
        // SECTION 2.2: VALIDATE REQUIRED FIELDS
        // -------------------------------------------------------------------------

        if (!body.feedback_type) {
            return NextResponse.json(
                { error: 'Feedback type is required' },
                { status: 400 }
            )
        }

        if (!body.description) {
            return NextResponse.json(
                { error: 'Description is required' },
                { status: 400 }
            )
        }

        // -------------------------------------------------------------------------
        // SECTION 2.3: INSERT FEEDBACK
        // -------------------------------------------------------------------------

        const { data, error } = await getSupabaseAdmin()
            .from('beta_feedback')
            .insert({
                user_id: body.user_id || null,
                company_id: body.company_id || null,
                feedback_type: body.feedback_type,
                title: body.title || null,
                description: body.description,
                rating: body.rating || null,
                page_url: body.page_url || null,
                page_name: body.page_name || null,
                user_agent: body.user_agent || null,
                screen_resolution: body.screen_resolution || null,
                status: 'new'
            })
            .select()
            .single()

        if (error) {
            console.error('Feedback insertion error:', error)
            throw error
        }

        // -------------------------------------------------------------------------
        // SECTION 2.4: OPTIONAL - SEND NOTIFICATION
        // -------------------------------------------------------------------------

        // Uncomment and configure this to send notifications to your N8N workflow
        // or any other notification service

        /*
        try {
          await fetch('https://your-n8n-instance.app.n8n.cloud/webhook/new-beta-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              feedback_id: data.feedback_id,
              feedback_type: body.feedback_type,
              title: body.title,
              description: body.description,
              page_url: body.page_url,
              user_id: body.user_id
            })
          })
        } catch (notifyError) {
          // Don't fail the request if notification fails
          console.log('Notification webhook failed:', notifyError)
        }
        */

        // -------------------------------------------------------------------------
        // SECTION 2.5: RETURN SUCCESS
        // -------------------------------------------------------------------------

        return NextResponse.json({
            success: true,
            feedbackId: data.feedback_id,
            message: 'Feedback submitted successfully'
        })

    } catch (error: any) {
        console.error('Feedback submission error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to submit feedback' },
            { status: 500 }
        )
    }
}

// ============================================================================
// SECTION 3: GET - RETRIEVE FEEDBACK (ADMIN ONLY)
// ============================================================================

export async function GET(request: NextRequest) {
    try {
        // -------------------------------------------------------------------------
        // SECTION 3.1: PARSE QUERY PARAMETERS
        // -------------------------------------------------------------------------

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const feedbackType = searchParams.get('type')
        const userId = searchParams.get('user_id')
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')

        // -------------------------------------------------------------------------
        // SECTION 3.2: BUILD QUERY
        // -------------------------------------------------------------------------

        let query = getSupabaseAdmin()
            .from('beta_feedback')
            .select(`
        *,
        user:users(first_name, last_name, email),
        company:companies(company_name)
      `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        // Apply filters
        if (status) {
            query = query.eq('status', status)
        }

        if (feedbackType) {
            query = query.eq('feedback_type', feedbackType)
        }

        if (userId) {
            query = query.eq('user_id', userId)
        }

        // -------------------------------------------------------------------------
        // SECTION 3.3: EXECUTE QUERY
        // -------------------------------------------------------------------------

        const { data, error, count } = await query

        if (error) {
            console.error('Feedback fetch error:', error)
            throw error
        }

        // -------------------------------------------------------------------------
        // SECTION 3.4: RETURN RESULTS
        // -------------------------------------------------------------------------

        return NextResponse.json({
            feedback: data,
            total: count,
            limit,
            offset
        })

    } catch (error: any) {
        console.error('Feedback fetch error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch feedback' },
            { status: 500 }
        )
    }
}

// ============================================================================
// SECTION 4: PATCH - UPDATE FEEDBACK (ADMIN ONLY)
// ============================================================================

export async function PATCH(request: NextRequest) {
    try {
        // -------------------------------------------------------------------------
        // SECTION 4.1: PARSE REQUEST BODY
        // -------------------------------------------------------------------------

        const body = await request.json()

        if (!body.feedback_id) {
            return NextResponse.json(
                { error: 'Feedback ID is required' },
                { status: 400 }
            )
        }

        // -------------------------------------------------------------------------
        // SECTION 4.2: BUILD UPDATE OBJECT
        // -------------------------------------------------------------------------

        const updates: Record<string, any> = {}

        if (body.status !== undefined) {
            updates.status = body.status
        }

        if (body.priority !== undefined) {
            updates.priority = body.priority
        }

        if (body.is_flagged !== undefined) {
            updates.is_flagged = body.is_flagged
        }

        if (body.admin_notes !== undefined) {
            updates.admin_notes = body.admin_notes
        }

        if (body.reviewed_at !== undefined) {
            updates.reviewed_at = body.reviewed_at
        }

        if (body.reviewed_by_admin_id !== undefined) {
            updates.reviewed_by_admin_id = body.reviewed_by_admin_id
        }

        if (body.resolved_at !== undefined) {
            updates.resolved_at = body.resolved_at
        }

        // -------------------------------------------------------------------------
        // SECTION 4.3: UPDATE FEEDBACK
        // -------------------------------------------------------------------------

        const { data, error } = await getSupabaseAdmin()
            .from('beta_feedback')
            .update(updates)
            .eq('feedback_id', body.feedback_id)
            .select()
            .single()

        if (error) {
            console.error('Feedback update error:', error)
            throw error
        }

        // -------------------------------------------------------------------------
        // SECTION 4.4: RETURN SUCCESS
        // -------------------------------------------------------------------------

        return NextResponse.json({
            success: true,
            feedback: data
        })

    } catch (error: any) {
        console.error('Feedback update error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to update feedback' },
            { status: 500 }
        )
    }
}