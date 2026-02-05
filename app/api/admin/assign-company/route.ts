// ============================================================================
// API Route: Assign Company & Admin Role
// ============================================================================
// File: app/api/admin/assign-company/route.ts
// Purpose: Server-side endpoint for assigning users to companies and
//          setting Company Admin role. Requires service role key for
//          auth.users metadata updates.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
}

// ============================================================================
// SECTION 1: AUTH VERIFICATION
// ============================================================================

async function verifyAdmin(request: NextRequest) {
    const supabaseAdmin = getAdminClient()
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return null
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null

    // Only platform admins can use this endpoint
    const adminEmails = ['paul.lyons67@icloud.com']
    if (!adminEmails.includes(user.email?.toLowerCase() || '')) {
        return null
    }
    return user
}

// ============================================================================
// SECTION 2: POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        const supabaseAdmin = getAdminClient()
        const admin = await verifyAdmin(request)
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { action, targetUserId, companyId, companyName } = body

        if (!targetUserId) {
            return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 })
        }

        // ==================================================================
        // ACTION: assign_company
        // Assigns a user to a company (updates auth metadata + company_users)
        // ==================================================================
        if (action === 'assign_company') {
            if (!companyId || !companyName) {
                return NextResponse.json({ error: 'companyId and companyName are required' }, { status: 400 })
            }

            // 1. Update auth.users metadata
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
                user_metadata: {
                    company: companyName,
                    company_id: companyId
                }
            })

            if (authError) {
                console.error('Auth metadata update error:', authError)
                return NextResponse.json({ error: 'Failed to update auth metadata', details: authError.message }, { status: 500 })
            }

            // 2. Update users table if it has company_id
            await supabaseAdmin
                .from('users')
                .update({ company_id: companyId, updated_at: new Date().toISOString() })
                .eq('user_id', targetUserId)

            // 3. Check if company_users record exists
            const { data: existing } = await supabaseAdmin
                .from('company_users')
                .select('company_user_id, role, status')
                .eq('user_id', targetUserId)
                .eq('company_id', companyId)
                .single()

            if (!existing) {
                // Get user email for the record
                const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
                const email = targetUser?.email || ''
                const fullName = `${targetUser?.user_metadata?.first_name || ''} ${targetUser?.user_metadata?.last_name || ''}`.trim()

                // Insert new company_users record
                const { error: insertError } = await supabaseAdmin
                    .from('company_users')
                    .insert({
                        company_id: companyId,
                        user_id: targetUserId,
                        email: email,
                        full_name: fullName,
                        role: 'user',
                        status: 'active',
                        invited_at: new Date().toISOString(),
                        invitation_accepted_at: new Date().toISOString()
                    })

                if (insertError) {
                    console.error('company_users insert error:', insertError)
                    return NextResponse.json({ error: 'Failed to create company user record', details: insertError.message }, { status: 500 })
                }
            }

            return NextResponse.json({ success: true, message: `User assigned to ${companyName}` })
        }

        // ==================================================================
        // ACTION: set_admin
        // Sets a user as Company Admin in company_users
        // ==================================================================
        if (action === 'set_admin') {
            if (!companyId) {
                return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
            }

            // Update role to admin
            const { error: updateError } = await supabaseAdmin
                .from('company_users')
                .update({ role: 'admin', updated_at: new Date().toISOString() })
                .eq('user_id', targetUserId)
                .eq('company_id', companyId)

            if (updateError) {
                console.error('Set admin error:', updateError)
                return NextResponse.json({ error: 'Failed to set admin role', details: updateError.message }, { status: 500 })
            }

            return NextResponse.json({ success: true, message: 'User set as Company Admin' })
        }

        // ==================================================================
        // ACTION: remove_admin
        // Demotes a Company Admin back to regular user
        // ==================================================================
        if (action === 'remove_admin') {
            if (!companyId) {
                return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
            }

            const { error: updateError } = await supabaseAdmin
                .from('company_users')
                .update({ role: 'user', updated_at: new Date().toISOString() })
                .eq('user_id', targetUserId)
                .eq('company_id', companyId)

            if (updateError) {
                console.error('Remove admin error:', updateError)
                return NextResponse.json({ error: 'Failed to remove admin role', details: updateError.message }, { status: 500 })
            }

            return NextResponse.json({ success: true, message: 'Admin role removed' })
        }

        // ==================================================================
        // ACTION: create_company
        // Creates a new company and assigns the user to it as admin
        // ==================================================================
        if (action === 'create_company') {
            if (!companyName) {
                return NextResponse.json({ error: 'companyName is required' }, { status: 400 })
            }

            // Create the company
            const { data: newCompany, error: companyError } = await supabaseAdmin
                .from('companies')
                .insert({
                    company_name: companyName,
                    company_type: 'customer',
                    created_by: admin.id
                })
                .select('company_id')
                .single()

            if (companyError) {
                console.error('Create company error:', companyError)
                return NextResponse.json({ error: 'Failed to create company', details: companyError.message }, { status: 500 })
            }

            const newCompanyId = newCompany.company_id

            // Update auth metadata
            await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
                user_metadata: {
                    company: companyName,
                    company_id: newCompanyId
                }
            })

            // Update users table
            await supabaseAdmin
                .from('users')
                .update({ company_id: newCompanyId, updated_at: new Date().toISOString() })
                .eq('user_id', targetUserId)

            // Get user details
            const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
            const email = targetUser?.email || ''
            const fullName = `${targetUser?.user_metadata?.first_name || ''} ${targetUser?.user_metadata?.last_name || ''}`.trim()

            // Insert as admin in company_users
            await supabaseAdmin
                .from('company_users')
                .insert({
                    company_id: newCompanyId,
                    user_id: targetUserId,
                    email: email,
                    full_name: fullName,
                    role: 'admin',
                    status: 'active',
                    invited_at: new Date().toISOString(),
                    invitation_accepted_at: new Date().toISOString()
                })

            return NextResponse.json({
                success: true,
                message: `Company "${companyName}" created. User set as Company Admin.`,
                companyId: newCompanyId
            })
        }

        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })

    } catch (error: any) {
        console.error('assign-company error:', error)
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
    }
}