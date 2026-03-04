import { NextRequest, NextResponse } from 'next/server'

// GET /api/dataroom/investors — List all investors (admin only)
export async function GET() {
  // TODO: Verify admin auth
  // TODO: Fetch from dataroom_investors table
  return NextResponse.json(
    { message: 'Not yet implemented', investors: [] },
    { status: 501 }
  )
}

// POST /api/dataroom/investors — Add a new investor (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, company_name, tier } = body

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    // TODO: Verify admin auth
    // TODO: Create auth.users record via Supabase Auth
    // TODO: Create dataroom_investors record
    // TODO: Grant category access based on tier
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
