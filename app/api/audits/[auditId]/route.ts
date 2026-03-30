// ============================================================================
// FILE: app/api/audits/[auditId]/route.ts
// PURPOSE: CRUD operations for individual alignment audits
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// GET /api/audits/:auditId — Fetch a single audit with enriched data
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ auditId: string }> }
) {
    const { auditId } = await params

    try {
        const supabase = createClient(supabaseUrl, supabaseKey)

        const { data: audit, error } = await supabase
            .from('alignment_audits')
            .select('*')
            .eq('audit_id', auditId)
            .single()

        if (error || !audit) {
            return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
        }

        // Enrich with playbook and template names
        const [{ data: playbook }, { data: template }] = await Promise.all([
            supabase
                .from('company_playbooks')
                .select('playbook_name, playbook_perspective, rules_extracted')
                .eq('playbook_id', audit.playbook_id)
                .single(),
            supabase
                .from('contract_templates')
                .select('template_name, contract_type, clause_count')
                .eq('template_id', audit.template_id)
                .single(),
        ])

        return NextResponse.json({
            ...audit,
            playbook_name: playbook?.playbook_name || 'Unknown',
            playbook_perspective: playbook?.playbook_perspective || 'customer',
            rules_extracted: playbook?.rules_extracted || 0,
            template_name: template?.template_name || 'Unknown',
            contract_type: template?.contract_type || 'custom',
            clause_count: template?.clause_count || 0,
        })
    } catch (err) {
        console.error('Error fetching audit:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/audits/:auditId — Update audit status/results
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ auditId: string }> }
) {
    const { auditId } = await params

    try {
        const body = await request.json()
        const supabase = createClient(supabaseUrl, supabaseKey)

        const updateData: Record<string, unknown> = {}

        if (body.status !== undefined) updateData.status = body.status
        if (body.results !== undefined) updateData.results = body.results
        if (body.overall_score !== undefined) updateData.overall_score = body.overall_score
        if (body.error_message !== undefined) updateData.error_message = body.error_message
        if (body.started_at !== undefined) updateData.started_at = body.started_at
        if (body.completed_at !== undefined) updateData.completed_at = body.completed_at

        const { data, error } = await supabase
            .from('alignment_audits')
            .update(updateData)
            .eq('audit_id', auditId)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json(data)
    } catch (err) {
        console.error('Error updating audit:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/audits/:auditId — Delete an audit
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ auditId: string }> }
) {
    const { auditId } = await params

    try {
        const supabase = createClient(supabaseUrl, supabaseKey)

        const { error } = await supabase
            .from('alignment_audits')
            .delete()
            .eq('audit_id', auditId)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Error deleting audit:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
