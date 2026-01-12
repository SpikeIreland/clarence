// ============================================================================
// CLARENCE Admin Create User API Route
// ============================================================================
// File: app/api/admin/create-user/route.ts
// Purpose: Allow admins to create beta tester accounts
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

    return createClient(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
}

// ============================================================================
// SECTION 2: POST - CREATE USER
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        // -------------------------------------------------------------------------
        // SECTION 2.1: VERIFY ADMIN AUTHORIZATION
        // -------------------------------------------------------------------------

        const authHeader = request.headers.get('Authorization')

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Unauthorized - No valid token provided' },
                { status: 401 }
            )
        }

        const token = authHeader.replace('Bearer ', '')

        // Verify the token and get user
        const { data: { user: adminUser }, error: authError } = await getSupabaseAdmin().auth.getUser(token)

        if (authError || !adminUser) {
            return NextResponse.json(
                { error: 'Unauthorized - Invalid token' },
                { status: 401 }
            )
        }

        // Check if user is admin
        const { data: adminProfile, error: profileError } = await getSupabaseAdmin()
            .from('users')
            .select('role')
            .eq('user_id', adminUser.id)
            .single()

        if (profileError || adminProfile?.role !== 'admin') {
            return NextResponse.json(
                { error: 'Forbidden - Admin access required' },
                { status: 403 }
            )
        }

        // -------------------------------------------------------------------------
        // SECTION 2.2: PARSE REQUEST BODY
        // -------------------------------------------------------------------------

        const body = await request.json()

        const { email, password, firstName, lastName, companyName } = body

        // -------------------------------------------------------------------------
        // SECTION 2.3: VALIDATE REQUIRED FIELDS
        // -------------------------------------------------------------------------

        if (!email || !password || !firstName || !lastName) {
            return NextResponse.json(
                { error: 'Email, password, first name, and last name are required' },
                { status: 400 }
            )
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            )
        }

        // Validate password length
        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters' },
                { status: 400 }
            )
        }

        // -------------------------------------------------------------------------
        // SECTION 2.4: CHECK IF USER ALREADY EXISTS
        // -------------------------------------------------------------------------

        const { data: existingUser } = await getSupabaseAdmin()
            .from('users')
            .select('user_id')
            .eq('email', email.toLowerCase())
            .single()

        if (existingUser) {
            return NextResponse.json(
                { error: 'A user with this email already exists' },
                { status: 400 }
            )
        }

        // -------------------------------------------------------------------------
        // SECTION 2.5: CREATE AUTH USER
        // -------------------------------------------------------------------------

        const { data: authData, error: createAuthError } = await getSupabaseAdmin().auth.admin.createUser({
            email: email.toLowerCase(),
            password: password,
            email_confirm: true // Auto-confirm email for beta testers
        })

        if (createAuthError) {
            console.error('Auth user creation error:', createAuthError)
            return NextResponse.json(
                { error: `Failed to create auth user: ${createAuthError.message}` },
                { status: 500 }
            )
        }

        const userId = authData.user.id

        // -------------------------------------------------------------------------
        // SECTION 2.6: CREATE OR GET COMPANY (OPTIONAL)
        // -------------------------------------------------------------------------

        let companyId = null

        if (companyName && companyName.trim()) {
            // Check if company exists
            const { data: existingCompany } = await getSupabaseAdmin()
                .from('companies')
                .select('company_id')
                .eq('company_name', companyName.trim())
                .single()

            if (existingCompany) {
                companyId = existingCompany.company_id
            } else {
                // Create new company
                const { data: newCompany, error: companyError } = await getSupabaseAdmin()
                    .from('companies')
                    .insert({
                        company_name: companyName.trim()
                    })
                    .select('company_id')
                    .single()

                if (companyError) {
                    console.error('Company creation error:', companyError)
                    // Don't fail - continue without company
                } else {
                    companyId = newCompany.company_id
                }
            }
        }

        // -------------------------------------------------------------------------
        // SECTION 2.7: CREATE USER PROFILE
        // -------------------------------------------------------------------------

        const { error: profileCreationError } = await getSupabaseAdmin()
            .from('users')
            .insert({
                user_id: userId,
                email: email.toLowerCase(),
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                company_id: companyId,
                is_beta_tester: true,
                role: 'user',
                created_at: new Date().toISOString()
            })

        if (profileCreationError) {
            console.error('Profile creation error:', profileCreationError)

            // Rollback: delete auth user if profile creation fails
            await getSupabaseAdmin().auth.admin.deleteUser(userId)

            return NextResponse.json(
                { error: `Failed to create user profile: ${profileCreationError.message}` },
                { status: 500 }
            )
        }

        // -------------------------------------------------------------------------
        // SECTION 2.8: RETURN SUCCESS
        // -------------------------------------------------------------------------

        return NextResponse.json({
            success: true,
            userId: userId,
            email: email.toLowerCase(),
            message: 'Beta tester created successfully'
        })

    } catch (error: any) {
        console.error('Create user error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to create user' },
            { status: 500 }
        )
    }
}

// ============================================================================
// SECTION 3: DELETE - REMOVE USER (OPTIONAL)
// ============================================================================

export async function DELETE(request: NextRequest) {
    try {
        // -------------------------------------------------------------------------
        // SECTION 3.1: VERIFY ADMIN AUTHORIZATION
        // -------------------------------------------------------------------------

        const authHeader = request.headers.get('Authorization')

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user: adminUser } } = await getSupabaseAdmin().auth.getUser(token)

        if (!adminUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Check admin role
        const { data: adminProfile } = await getSupabaseAdmin()
            .from('users')
            .select('role')
            .eq('user_id', adminUser.id)
            .single()

        if (adminProfile?.role !== 'admin') {
            return NextResponse.json(
                { error: 'Forbidden' },
                { status: 403 }
            )
        }

        // -------------------------------------------------------------------------
        // SECTION 3.2: GET USER ID FROM BODY
        // -------------------------------------------------------------------------

        const body = await request.json()
        const { userId } = body

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            )
        }

        // -------------------------------------------------------------------------
        // SECTION 3.3: DELETE USER PROFILE
        // -------------------------------------------------------------------------

        const { error: profileDeleteError } = await getSupabaseAdmin()
            .from('users')
            .delete()
            .eq('user_id', userId)

        if (profileDeleteError) {
            console.error('Profile deletion error:', profileDeleteError)
        }

        // -------------------------------------------------------------------------
        // SECTION 3.4: DELETE AUTH USER
        // -------------------------------------------------------------------------

        const { error: authDeleteError } = await getSupabaseAdmin().auth.admin.deleteUser(userId)

        if (authDeleteError) {
            console.error('Auth deletion error:', authDeleteError)
            return NextResponse.json(
                { error: `Failed to delete auth user: ${authDeleteError.message}` },
                { status: 500 }
            )
        }

        // -------------------------------------------------------------------------
        // SECTION 3.5: RETURN SUCCESS
        // -------------------------------------------------------------------------

        return NextResponse.json({
            success: true,
            message: 'User deleted successfully'
        })

    } catch (error: any) {
        console.error('Delete user error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to delete user' },
            { status: 500 }
        )
    }
}