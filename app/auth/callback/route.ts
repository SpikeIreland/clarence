// ============================================================================
// AUTH CALLBACK ROUTE HANDLER
// Location: app/auth/callback/route.ts
// Purpose: Handle Supabase email confirmation and OAuth callbacks
// ============================================================================

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// ============================================================================
// SECTION 1: GET HANDLER
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

    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // ========================================================================
    // SECTION 2: HANDLE EMAIL CONFIRMATION (token_hash)
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
    // SECTION 3: HANDLE CODE EXCHANGE (OAuth/Magic Link)
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
    // SECTION 4: NO VALID PARAMS - REDIRECT TO LOGIN
    // ========================================================================

    console.log('No code or token_hash provided, redirecting to login')
    return NextResponse.redirect(`${origin}/auth/login`)
}