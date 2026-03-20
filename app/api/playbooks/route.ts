// ============================================================================
// FILE: app/api/playbooks/route.ts
// PURPOSE: POST endpoint for creating a new company playbook
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const {
            company_id,
            playbook_name,
            contract_type_key,
            playbook_perspective,
            status,
            created_by_user_id,
        } = body

        if (!company_id || !playbook_name) {
            return NextResponse.json(
                { error: 'company_id and playbook_name are required' },
                { status: 400 }
            )
        }

        if (playbook_perspective && !['customer', 'provider'].includes(playbook_perspective)) {
            return NextResponse.json(
                { error: 'playbook_perspective must be "customer" or "provider"' },
                { status: 400 }
            )
        }

        const supabase = createServiceRoleClient()
        const typeKey = contract_type_key || null

        // Deactivate any existing active playbook for the same company + contract type
        // to avoid violating the uix_company_playbooks_active_type unique constraint
        if (typeKey) {
            await supabase
                .from('company_playbooks')
                .update({ is_active: false, status: 'inactive' })
                .eq('company_id', company_id)
                .eq('contract_type_key', typeKey)
                .eq('is_active', true)
        } else {
            await supabase
                .from('company_playbooks')
                .update({ is_active: false, status: 'inactive' })
                .eq('company_id', company_id)
                .is('contract_type_key', null)
                .eq('is_active', true)
        }

        const { data, error } = await supabase
            .from('company_playbooks')
            .insert({
                company_id,
                playbook_name,
                contract_type_key: typeKey,
                playbook_perspective: playbook_perspective || 'customer',
                status: status || 'active',
                is_active: true,
                created_by_user_id: created_by_user_id || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (error) {
            console.error('Playbook creation error:', error)
            return NextResponse.json(
                { error: 'Failed to create playbook', details: error.message },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true, playbook: data })
    } catch (error) {
        console.error('Playbook POST error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
