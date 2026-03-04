import { NextRequest, NextResponse } from 'next/server'

// POST /api/dataroom/auth/magic-link
// Sends a magic link to an invited investor's email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // TODO: Verify email exists in dataroom_investors
    // TODO: Send magic link via Supabase Auth with redirect to dataroom callback
    return NextResponse.json(
      { message: 'Not yet implemented' },
      { status: 501 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
