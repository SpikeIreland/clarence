import { NextRequest, NextResponse } from 'next/server'

// GET /api/dataroom/documents — List documents (filtered by access)
export async function GET() {
  // TODO: Determine user role (admin sees all, investor sees accessible)
  // TODO: Fetch from dataroom_documents with category join
  return NextResponse.json(
    { message: 'Not yet implemented', documents: [] },
    { status: 501 }
  )
}

// POST /api/dataroom/documents — Upload a document (admin only)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const title = formData.get('title')
    const category_id = formData.get('category_id')

    if (!file || !title || !category_id) {
      return NextResponse.json(
        { error: 'File, title, and category are required' },
        { status: 400 }
      )
    }

    // TODO: Verify admin auth
    // TODO: Upload file to Supabase Storage
    // TODO: Create dataroom_documents record
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
