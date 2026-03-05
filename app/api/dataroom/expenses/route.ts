import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/dataroom/supabase'
import { createClient } from '@supabase/supabase-js'

// Helper: get authenticated user from request
async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

// GET /api/dataroom/expenses — List all expenses with summary
export async function GET() {
  try {
    const supabase = createServiceRoleClient()

    const { data: expenses, error } = await supabase
      .from('dataroom_expenses')
      .select(`
        *,
        category:dataroom_expense_categories(name)
      `)
      .order('expense_date', { ascending: false })

    if (error) {
      console.error('Error fetching expenses:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate summary
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const total = (expenses || []).reduce((sum, e) => sum + Number(e.amount), 0)

    const thisMonth = (expenses || []).reduce((sum, e) => {
      const d = new Date(e.expense_date)
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        return sum + Number(e.amount)
      }
      return sum
    }, 0)

    const recurringMonthly = (expenses || []).reduce((sum, e) => {
      if (!e.is_recurring) return sum
      const amount = Number(e.amount)
      switch (e.recurring_frequency) {
        case 'monthly': return sum + amount
        case 'quarterly': return sum + amount / 3
        case 'annually': return sum + amount / 12
        default: return sum
      }
    }, 0)

    return NextResponse.json({
      expenses: expenses || [],
      summary: {
        total: Math.round(total * 100) / 100,
        thisMonth: Math.round(thisMonth * 100) / 100,
        recurringMonthly: Math.round(recurringMonthly * 100) / 100,
      },
    })
  } catch (err) {
    console.error('Error in GET /api/dataroom/expenses:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/dataroom/expenses — Log a new expense
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { expense_category_id, amount, description, expense_date, is_recurring, recurring_frequency } = body

    if (!expense_category_id || !amount || !description || !expense_date) {
      return NextResponse.json(
        { error: 'Category, amount, description, and date are required' },
        { status: 400 }
      )
    }

    if (Number(amount) <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    const { data, error } = await supabase
      .from('dataroom_expenses')
      .insert({
        expense_category_id,
        amount: Number(amount),
        description,
        expense_date,
        entered_by: user.id,
        is_recurring: is_recurring || false,
        recurring_frequency: is_recurring ? recurring_frequency : null,
      })
      .select(`
        *,
        category:dataroom_expense_categories(name)
      `)
      .single()

    if (error) {
      console.error('Error creating expense:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, expense: data })
  } catch (err) {
    console.error('Error in POST /api/dataroom/expenses:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/dataroom/expenses — Delete an expense
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { expense_id } = body

    if (!expense_id) {
      return NextResponse.json(
        { error: 'expense_id is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    const { error } = await supabase
      .from('dataroom_expenses')
      .delete()
      .eq('expense_id', expense_id)

    if (error) {
      console.error('Error deleting expense:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in DELETE /api/dataroom/expenses:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
