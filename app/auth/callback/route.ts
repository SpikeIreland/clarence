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
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle OAuth errors
    if (error) {
        console.error('Auth callback error:', error, errorDescription)
        return NextResponse.redirect(
            `${origin}/auth/customer?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || 'Authentication failed')}`
        )
    }

    // Exchange code for session
    if (code) {
        try {
            const cookieStore = cookies()
            const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

            if (exchangeError) {
                console.error('Code exchange error:', exchangeError)
                return NextResponse.redirect(
                    `${origin}/auth/customer?error=exchange_failed&message=${encodeURIComponent(exchangeError.message)}`
                )
            }

            if (data.user) {
                // Check user type from metadata to route appropriately
                const userType = data.user.user_metadata?.user_type || 'customer'

                if (userType === 'provider') {
                    // Provider users go to provider portal
                    // Check if they have a session in progress
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
                `${origin}/auth/customer?error=callback_failed&message=An unexpected error occurred`
            )
        }
    }

    // No code provided - redirect to auth page
    return NextResponse.redirect(`${origin}/auth/customer`)
}