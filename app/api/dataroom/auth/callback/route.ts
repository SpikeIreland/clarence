import { NextRequest, NextResponse } from 'next/server'

// GET /api/dataroom/auth/callback
// Handles magic link callback — exchanges code for session
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/dataroom', request.url))
  }

  // TODO: Exchange code for Supabase session
  // TODO: Verify user exists in dataroom_investors
  // TODO: Log access event
  // TODO: Redirect to /dashboard (on dataroom subdomain)
  return NextResponse.redirect(new URL('/dataroom/dashboard', request.url))
}
