// ============================================================================
// AUTH CALLBACK ROUTE HANDLER
// Location: app/auth/callback/route.ts
// Purpose: Handle Supabase email confirmation and OAuth callbacks
// Updated: Uses @supabase/ssr for Next.js 14+ compatibility
// ============================================================================

import { createServerClient } from '@supabase/ssr'
import { createServiceRoleClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

interface UserMetadata {
    first_name?: string
    last_name?: string
    phone?: string
    company_name?: string
    company_id?: string
    job_title?: string
    department?: string
    user_type?: string
    session_id?: string
}

interface UserRecord {
    user_id: string
    company_id: string | null
}

interface CompanyRecord {
    company_id: string
}

// ============================================================================
// SECTION 2: CREATE SUPABASE CLIENT FOR ROUTE HANDLER
// ============================================================================

async function createSupabaseClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options)
                        })
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing sessions.
                    }
                },
            },
        }
    )
}

// ============================================================================
// SECTION 3: HELPER - CREATE USER AND COMPANY RECORDS
// Uses service role client for full database access
// ============================================================================

async function ensureUserAndCompanyRecords(
    user: {
        id: string
        email?: string
        user_metadata?: UserMetadata
    }
): Promise<{ userId: string; companyId: string | null }> {
    const metadata = user.user_metadata || {}

    // Use service role client for database operations
    const supabase = createServiceRoleClient()

    console.log('Ensuring user and company records for:', user.id, user.email)
    console.log('Metadata received:', JSON.stringify(metadata))

    // Step 1: Check if user already exists in public.users
    const { data: existingUser, error: checkError } = await (supabase
        .from('users') as any)
        .select('user_id, company_id')
        .eq('user_id', user.id)
        .single()

    if (!checkError && existingUser) {
        console.log('User already exists in public.users:', existingUser)
        return {
            userId: (existingUser as UserRecord).user_id,
            companyId: (existingUser as UserRecord).company_id
        }
    }

    // User doesn't exist - create records
    console.log('Creating new user record...')

    // Build contact_person from first + last name
    const firstName = metadata.first_name || ''
    const lastName = metadata.last_name || ''
    const contactPerson = `${firstName} ${lastName}`.trim() || 'Unknown'
    const companyName = metadata.company_name || 'Unknown Company'

    let companyId: string | null = metadata.company_id || null

    // Step 2: Create company if needed
    if (!companyId && companyName && companyName !== 'Unknown Company') {
        console.log('Looking for or creating company:', companyName)

        // First check if company with this name already exists
        const { data: existingCompany, error: companyCheckError } = await (supabase
            .from('companies') as any)
            .select('company_id')
            .eq('company_name', companyName)
            .single()

        if (!companyCheckError && existingCompany) {
            companyId = (existingCompany as CompanyRecord).company_id
            console.log('Found existing company:', companyId)
        } else {
            // Create new company
            console.log('Creating new company...')
            const { data: newCompany, error: companyError } = await (supabase
                .from('companies') as any)
                .insert({
                    company_name: companyName,
                    company_type: 'customer',
                    created_at: new Date().toISOString()
                })
                .select('company_id')
                .single()

            if (companyError) {
                console.error('Error creating company:', companyError)
                // Continue without company - don't block user creation
            } else if (newCompany) {
                companyId = (newCompany as CompanyRecord).company_id
                console.log('Created new company:', companyId)
            }
        }
    }

    // Step 3: Create user record with correct schema
    console.log('Inserting user with company_id:', companyId)
    const { error: userError } = await (supabase
        .from('users') as any)
        .insert({
            user_id: user.id,
            email: user.email || 'unknown@email.com',
            company_name: companyName,
            contact_person: contactPerson,
            role: metadata.user_type || 'customer',
            phone: metadata.phone || null,
            first_name: firstName || null,
            last_name: lastName || null,
            company_id: companyId,
            user_type: metadata.user_type || 'customer',
            is_active: true,
            email_verified: true,
            registration_date: new Date().toISOString(),
            created_at: new Date().toISOString()
        })

    if (userError) {
        console.error('Error creating user record:', userError)
        // If it's a duplicate key error, user was created by another request
        if (!userError.message.includes('duplicate')) {
            throw userError
        }
    } else {
        console.log('Successfully created user record')
    }

    // Step 4: Update company with created_by now that user exists
    if (companyId && !metadata.company_id) {
        // This was a new company we created - update created_by
        const { error: updateError } = await (supabase
            .from('companies') as any)
            .update({ created_by: user.id })
            .eq('company_id', companyId)

        if (updateError) {
            console.error('Error updating company created_by:', updateError)
        } else {
            console.log('Updated company created_by:', companyId)
        }
    }

    return { userId: user.id, companyId }
}

// ============================================================================
// SECTION 4: GET HANDLER
// ============================================================================

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')

    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    console.log('Auth callback received:', { code, token_hash, type, error })

    // Handle OAuth errors
    if (error) {
        console.error('Auth callback error:', error, errorDescription)
        return NextResponse.redirect(
            `${origin}/auth/login?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || 'Authentication failed')}`
        )
    }

    // Create Supabase client for auth operations
    const supabase = await createSupabaseClient()

    // ========================================================================
    // SECTION 5: HANDLE EMAIL CONFIRMATION (token_hash)
    // ========================================================================

    if (token_hash && type) {
        try {
            console.log('Verifying OTP with token_hash:', token_hash, 'type:', type)

            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                token_hash,
                type: type as 'signup' | 'email' | 'recovery' | 'invite',
            })

            if (verifyError) {
                console.error('OTP verification error:', verifyError)
                return NextResponse.redirect(
                    `${origin}/auth/login?error=verification_failed&message=${encodeURIComponent(verifyError.message)}`
                )
            }

            console.log('OTP verification successful:', data)

            // ================================================================
            // CREATE USER AND COMPANY RECORDS AFTER EMAIL CONFIRMATION
            // ================================================================
            if (data.user) {
                try {
                    const { userId, companyId } = await ensureUserAndCompanyRecords(data.user)
                    console.log('User/company records ensured:', { userId, companyId })
                } catch (recordError) {
                    console.error('Error creating user records:', recordError)
                    // Don't fail the entire flow - user can still login
                }
            }

            // Email confirmed successfully - redirect to login with success message
            return NextResponse.redirect(
                `${origin}/auth/login?message=${encodeURIComponent('Email confirmed successfully! Please sign in.')}`
            )
        } catch (err) {
            console.error('OTP verification exception:', err)
            return NextResponse.redirect(
                `${origin}/auth/login?error=verification_failed&message=An unexpected error occurred`
            )
        }
    }

    // ========================================================================
    // SECTION 6: HANDLE CODE EXCHANGE (OAuth/Magic Link)
    // ========================================================================

    if (code) {
        try {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

            if (exchangeError) {
                console.error('Code exchange error:', exchangeError)
                return NextResponse.redirect(
                    `${origin}/auth/login?error=exchange_failed&message=${encodeURIComponent(exchangeError.message)}`
                )
            }

            if (data.user) {
                // ============================================================
                // CREATE USER AND COMPANY RECORDS IF THEY DON'T EXIST
                // ============================================================
                try {
                    const { userId, companyId } = await ensureUserAndCompanyRecords(data.user)
                    console.log('User/company records ensured:', { userId, companyId })
                } catch (recordError) {
                    console.error('Error creating user records:', recordError)
                    // Don't fail - continue with redirect
                }

                // Check user type from metadata to route appropriately
                const userType = data.user.user_metadata?.user_type || 'customer'

                if (userType === 'provider') {
                    // Provider users go to provider portal
                    const sessionId = data.user.user_metadata?.session_id
                    if (sessionId) {
                        return NextResponse.redirect(`${origin}/provider/welcome?session_id=${sessionId}`)
                    }
                    return NextResponse.redirect(`${origin}/provider`)
                } else {
                    // Customer users go to dashboard
                    return NextResponse.redirect(`${origin}/auth/dashboard`)
                }
            }
        } catch (err) {
            console.error('Auth callback exception:', err)
            return NextResponse.redirect(
                `${origin}/auth/login?error=callback_failed&message=An unexpected error occurred`
            )
        }
    }

    // ========================================================================
    // SECTION 7: NO VALID PARAMS - REDIRECT TO LOGIN
    // ========================================================================

    console.log('No code or token_hash provided, redirecting to login')
    return NextResponse.redirect(`${origin}/auth/login`)
}