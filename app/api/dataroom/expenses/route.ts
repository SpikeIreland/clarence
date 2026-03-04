import { NextRequest, NextResponse } from 'next/server'

// GET /api/dataroom/expenses — List all expenses (admin only)
export async function GET() {
  // TODO: Verify admin auth
  // TODO: Fetch from dataroom_expenses with category join
  return NextResponse.json(
    { message: 'Not yet implemented', expenses: [] },
    { status: 501 }
  )
}

// POST /api/dataroom/expenses — Log a new expense (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { expense_category_id, amount, description, expense_date } = body

    if (!expense_category_id || !amount || !description || !expense_date) {
      return NextResponse.json(
        { error: 'Category, amount, description, and date are required' },
        { status: 400 }
      )
    }

    // TODO: Verify admin auth
    // TODO: Insert into dataroom_expenses
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
