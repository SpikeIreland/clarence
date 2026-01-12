'use client'

// ============================================================================
// CLARENCE Beta Testing Admin Dashboard
// ============================================================================
// File: app/admin/beta-testing/page.tsx
// Purpose: Admin interface for managing beta testers and feedback
// ============================================================================

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface UserProfile {
    user_id: string
    email: string
    first_name: string
    last_name: string
    is_beta_tester: boolean
    role: string
    created_at: string
    last_login_at: string | null
    company_id: string | null
}

interface Company {
    company_id: string
    company_name: string
}

interface Session {
    session_id: string
    session_name: string
    status: string
    created_at: string
}

interface BetaFeedback {
    feedback_id: string
    user_id: string
    company_id: string | null
    feedback_type: string
    title: string | null
    description: string
    page_url: string | null
    page_name: string | null
    status: string
    priority: string | null
    is_flagged: boolean
    admin_notes: string | null
    reviewed_at: string | null
    created_at: string
}

interface BetaFeedbackWithDetails extends BetaFeedback {
    user?: {
        first_name: string
        last_name: string
        email: string
    }
    company?: {
        company_name: string
    }
}

interface UserDetails {
    profile: UserProfile
    company: Company | null
    sessions: Session[]
    feedback: BetaFeedback[]
}

interface DashboardStats {
    totalBetaTesters: number
    activeThisWeek: number
    totalSessions: number
    averageRating: number
    pendingFeedback: number
}

// ============================================================================
// SECTION 2: MAIN COMPONENT
// ============================================================================

export default function BetaTestingAdminDashboard() {
    const router = useRouter()
    const supabase = createClient()

    // -------------------------------------------------------------------------
    // SECTION 2.1: STATE MANAGEMENT
    // -------------------------------------------------------------------------

    // Auth state
    const [isAdmin, setIsAdmin] = useState(false)
    const [adminEmail, setAdminEmail] = useState('')
    const [loading, setLoading] = useState(true)

    // Tab state
    const [activeTab, setActiveTab] = useState<'create' | 'users' | 'feedback' | 'stats'>('users')

    // Create user state
    const [createForm, setCreateForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        companyName: ''
    })
    const [generatedPassword, setGeneratedPassword] = useState('')
    const [creating, setCreating] = useState(false)
    const [createSuccess, setCreateSuccess] = useState(false)

    // User search state
    const [searchQuery, setSearchQuery] = useState('')
    const [users, setUsers] = useState<UserProfile[]>([])
    const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null)
    const [loadingUser, setLoadingUser] = useState(false)

    // Feedback state
    const [allFeedback, setAllFeedback] = useState<BetaFeedbackWithDetails[]>([])
    const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'flagged' | 'unreviewed'>('all')

    // Stats state
    const [stats, setStats] = useState<DashboardStats>({
        totalBetaTesters: 0,
        activeThisWeek: 0,
        totalSessions: 0,
        averageRating: 0,
        pendingFeedback: 0
    })

    // -------------------------------------------------------------------------
    // SECTION 2.2: EFFECTS
    // -------------------------------------------------------------------------

    // Check admin access on mount
    useEffect(() => {
        checkAdminAccess()
    }, [])

    // Load data when tab changes
    useEffect(() => {
        if (isAdmin && activeTab === 'users') {
            loadUsers()
        } else if (isAdmin && activeTab === 'feedback') {
            loadAllFeedback()
        } else if (isAdmin && activeTab === 'stats') {
            loadStats()
        }
    }, [isAdmin, activeTab, feedbackFilter])

    // -------------------------------------------------------------------------
    // SECTION 2.3: AUTH FUNCTIONS
    // -------------------------------------------------------------------------

    async function checkAdminAccess() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            console.log('🔍 Admin check - User:', user?.id, user?.email)

            if (!user) {
                console.log('❌ No user, redirecting to login')
                router.push('/login')
                return
            }

            // Check if user has admin role
            const { data: profile } = await supabase
                .from('users')
                .select('role, email')
                .eq('user_id', user.id)
                .single()

            console.log('🔍 Admin check - Profile:', profile)
            console.log('🔍 Admin check - Role:', profile?.role)

            if (profile?.role === 'admin') {
                console.log('✅ User is admin!')
                setIsAdmin(true)
                setAdminEmail(profile.email)
            } else {
                console.log('❌ User is NOT admin, redirecting')
                router.push('/dashboard')
            }
        } catch (error) {
            console.error('Admin access check failed:', error)
            router.push('/dashboard')
        } finally {
            setLoading(false)
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 2.4: USER MANAGEMENT FUNCTIONS
    // -------------------------------------------------------------------------

    function generatePassword() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
        let password = ''
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        setGeneratedPassword(password)
    }

    async function createUser() {
        if (!createForm.firstName || !createForm.lastName || !createForm.email || !generatedPassword) {
            alert('Please fill in all required fields and generate a password')
            return
        }

        setCreating(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                alert('❌ Session expired. Please refresh the page.')
                return
            }

            const response = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    email: createForm.email,
                    password: generatedPassword,
                    firstName: createForm.firstName,
                    lastName: createForm.lastName,
                    companyName: createForm.companyName
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || 'Failed to create user')
            }

            const { userId } = await response.json()

            // Log admin action
            await supabase.from('admin_actions').insert({
                admin_id: (await supabase.auth.getUser()).data.user?.id,
                admin_email: adminEmail,
                action_type: 'create_user',
                target_user_id: userId,
                target_user_email: createForm.email,
                details: {
                    firstName: createForm.firstName,
                    lastName: createForm.lastName,
                    companyName: createForm.companyName
                }
            })

            // Trigger welcome email workflow (update URL to your N8N instance)
            await fetch('https://your-n8n-instance.app.n8n.cloud/webhook/admin-send-welcome-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: createForm.firstName,
                    lastName: createForm.lastName,
                    email: createForm.email,
                    tempPassword: generatedPassword
                })
            }).catch(() => console.log('Welcome email webhook triggered'))

            setCreateSuccess(true)
            navigator.clipboard.writeText(generatedPassword)

            alert(`✅ Beta tester created successfully!\n\nPassword copied to clipboard:\n${generatedPassword}\n\nWelcome email sent to ${createForm.email}`)

            // Reset form
            setCreateForm({ firstName: '', lastName: '', email: '', companyName: '' })
            setGeneratedPassword('')

            setTimeout(() => setCreateSuccess(false), 3000)

        } catch (error: any) {
            console.error('Error creating user:', error)
            alert(`❌ Failed to create user: ${error.message}`)
        } finally {
            setCreating(false)
        }
    }

    async function loadUsers() {
        try {
            const { data } = await supabase
                .from('users')
                .select('*')
                .eq('is_beta_tester', true)
                .order('created_at', { ascending: false })

            setUsers(data || [])
        } catch (error) {
            console.error('Error loading users:', error)
        }
    }

    async function loadUserDetails(userId: string) {
        setLoadingUser(true)
        try {
            // Get profile
            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('user_id', userId)
                .single()

            // Get company if exists
            let company = null
            if (profile?.company_id) {
                const { data: companyData } = await supabase
                    .from('companies')
                    .select('*')
                    .eq('company_id', profile.company_id)
                    .single()
                company = companyData
            }

            // Get sessions
            const { data: sessions } = await supabase
                .from('sessions')
                .select('session_id, session_name, status, created_at')
                .eq('customer_user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10)

            // Get feedback
            const { data: feedback } = await supabase
                .from('beta_feedback')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            setSelectedUser({
                profile,
                company,
                sessions: sessions || [],
                feedback: feedback || []
            })

        } catch (error) {
            console.error('Error loading user details:', error)
        } finally {
            setLoadingUser(false)
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 2.5: FEEDBACK FUNCTIONS
    // -------------------------------------------------------------------------

    async function loadAllFeedback() {
        try {
            let query = supabase
                .from('beta_feedback')
                .select(`
          *,
          user:users(first_name, last_name, email),
          company:companies(company_name)
        `)
                .order('created_at', { ascending: false })

            if (feedbackFilter === 'flagged') {
                query = query.eq('is_flagged', true)
            } else if (feedbackFilter === 'unreviewed') {
                query = query.is('reviewed_at', null)
            }

            const { data } = await query
            setAllFeedback(data || [])
        } catch (error) {
            console.error('Error loading feedback:', error)
        }
    }

    async function toggleFeedbackFlag(feedbackId: string, currentFlag: boolean) {
        try {
            await supabase
                .from('beta_feedback')
                .update({ is_flagged: !currentFlag })
                .eq('feedback_id', feedbackId)

            loadAllFeedback()
        } catch (error) {
            console.error('Error toggling flag:', error)
        }
    }

    async function markFeedbackReviewed(feedbackId: string, notes?: string) {
        try {
            const adminUser = await supabase.auth.getUser()

            await supabase
                .from('beta_feedback')
                .update({
                    status: 'reviewed',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by_admin_id: adminUser.data.user?.id,
                    admin_notes: notes || null
                })
                .eq('feedback_id', feedbackId)

            // Log admin action
            await supabase.from('admin_actions').insert({
                admin_id: adminUser.data.user?.id,
                admin_email: adminEmail,
                action_type: 'review_feedback',
                details: { feedback_id: feedbackId, notes }
            })

            loadAllFeedback()
        } catch (error) {
            console.error('Error marking reviewed:', error)
        }
    }

    async function updateFeedbackPriority(feedbackId: string, priority: string) {
        try {
            await supabase
                .from('beta_feedback')
                .update({ priority })
                .eq('feedback_id', feedbackId)

            loadAllFeedback()
        } catch (error) {
            console.error('Error updating priority:', error)
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 2.6: STATS FUNCTIONS
    // -------------------------------------------------------------------------

    async function loadStats() {
        try {
            // Total beta testers
            const { count: totalBeta } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('is_beta_tester', true)

            // Active this week
            const oneWeekAgo = new Date()
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

            const { count: activeCount } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('is_beta_tester', true)
                .gte('last_login_at', oneWeekAgo.toISOString())

            // Total sessions created by beta testers
            const { count: sessionsCount } = await supabase
                .from('sessions')
                .select('*', { count: 'exact', head: true })

            // Pending feedback count
            const { count: pendingCount } = await supabase
                .from('beta_feedback')
                .select('*', { count: 'exact', head: true })
                .is('reviewed_at', null)

            // Average rating from feedback
            const { data: ratings } = await supabase
                .from('beta_feedback')
                .select('rating')
                .not('rating', 'is', null)

            const avgRating = ratings && ratings.length > 0
                ? ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length
                : 0

            setStats({
                totalBetaTesters: totalBeta || 0,
                activeThisWeek: activeCount || 0,
                totalSessions: sessionsCount || 0,
                averageRating: Math.round(avgRating * 10) / 10,
                pendingFeedback: pendingCount || 0
            })

        } catch (error) {
            console.error('Error loading stats:', error)
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 2.7: HELPER FUNCTIONS
    // -------------------------------------------------------------------------

    function getFeedbackTypeIcon(type: string) {
        switch (type) {
            case 'bug': return '🐛'
            case 'feature': return '💡'
            case 'usability': return '🎯'
            default: return '💬'
        }
    }

    function getFeedbackTypeLabel(type: string) {
        switch (type) {
            case 'bug': return 'Bug Report'
            case 'feature': return 'Feature Request'
            case 'usability': return 'Usability Issue'
            default: return 'General Feedback'
        }
    }

    function getPriorityColor(priority: string | null) {
        switch (priority) {
            case 'critical': return 'bg-red-100 text-red-700 border-red-300'
            case 'high': return 'bg-orange-100 text-orange-700 border-orange-300'
            case 'medium': return 'bg-amber-100 text-amber-700 border-amber-300'
            case 'low': return 'bg-slate-100 text-slate-700 border-slate-300'
            default: return 'bg-slate-50 text-slate-500 border-slate-200'
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 2.8: LOADING STATE
    // -------------------------------------------------------------------------

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="text-4xl mb-4">🔐</div>
                    <p className="text-slate-600 font-medium">Verifying admin access...</p>
                </div>
            </div>
        )
    }

    if (!isAdmin) {
        return null
    }

    // -------------------------------------------------------------------------
    // SECTION 2.9: MAIN RENDER
    // -------------------------------------------------------------------------

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ================================================================== */}
            {/* HEADER */}
            {/* ================================================================== */}
            <header className="bg-[#1e3a5f] shadow-lg sticky top-0 z-50">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="text-2xl font-bold text-white">
                                CLARENCE
                            </Link>
                            <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-sm font-bold">
                                BETA ADMIN
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-slate-300">{adminEmail}</span>
                            <Link
                                href="/dashboard"
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                            >
                                Dashboard
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* ================================================================== */}
            {/* TAB NAVIGATION */}
            {/* ================================================================== */}
            <div className="bg-white border-b border-slate-200">
                <div className="container mx-auto px-6">
                    <div className="flex gap-8">
                        {/* Create User Tab */}
                        <button
                            onClick={() => setActiveTab('create')}
                            className={`py-4 px-2 border-b-2 font-semibold transition-colors ${activeTab === 'create'
                                    ? 'border-[#2563eb] text-[#2563eb]'
                                    : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            ➕ Create Tester
                        </button>

                        {/* Users Tab */}
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`py-4 px-2 border-b-2 font-semibold transition-colors ${activeTab === 'users'
                                    ? 'border-[#2563eb] text-[#2563eb]'
                                    : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            👥 Testers ({users.length})
                        </button>

                        {/* Feedback Tab */}
                        <button
                            onClick={() => setActiveTab('feedback')}
                            className={`py-4 px-2 border-b-2 font-semibold transition-colors ${activeTab === 'feedback'
                                    ? 'border-[#2563eb] text-[#2563eb]'
                                    : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            💬 Feedback ({allFeedback.length})
                        </button>

                        {/* Stats Tab */}
                        <button
                            onClick={() => setActiveTab('stats')}
                            className={`py-4 px-2 border-b-2 font-semibold transition-colors ${activeTab === 'stats'
                                    ? 'border-[#2563eb] text-[#2563eb]'
                                    : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            📊 Stats
                        </button>
                    </div>
                </div>
            </div>

            {/* ================================================================== */}
            {/* MAIN CONTENT */}
            {/* ================================================================== */}
            <main className="container mx-auto px-6 py-8">

                {/* ================================================================ */}
                {/* CREATE USER TAB */}
                {/* ================================================================ */}
                {activeTab === 'create' && (
                    <div className="max-w-2xl mx-auto">
                        <div className="bg-white rounded-2xl shadow-lg p-8">
                            <h2 className="text-2xl font-bold text-slate-900 mb-6">
                                Create Beta Tester Account
                            </h2>

                            <div className="space-y-4">
                                {/* First Name */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        First Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={createForm.firstName}
                                        onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                                        placeholder="John"
                                    />
                                </div>

                                {/* Last Name */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Last Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={createForm.lastName}
                                        onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                                        placeholder="Smith"
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={createForm.email}
                                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                                        placeholder="john@company.com"
                                    />
                                </div>

                                {/* Company Name (Optional) */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Company Name <span className="text-slate-400">(optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={createForm.companyName}
                                        onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                                        placeholder="Acme Corp"
                                    />
                                </div>

                                {/* Temporary Password */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Temporary Password <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={generatedPassword}
                                            readOnly
                                            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 font-mono text-sm"
                                            placeholder="Click 'Generate Password'"
                                        />
                                        <button
                                            onClick={generatePassword}
                                            type="button"
                                            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors"
                                        >
                                            🔑 Generate
                                        </button>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <div className="pt-4">
                                    <button
                                        onClick={createUser}
                                        disabled={creating || !generatedPassword}
                                        className="w-full py-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {creating ? '⏳ Creating Account...' : '✉️ Create Account & Send Welcome Email'}
                                    </button>
                                </div>

                                {/* Success Message */}
                                {createSuccess && (
                                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                                        <p className="text-emerald-800 font-semibold">✅ Beta tester created successfully!</p>
                                        <p className="text-emerald-700 text-sm mt-1">Password copied to clipboard. Welcome email sent.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-900 font-semibold">📋 What happens:</p>
                            <ul className="text-sm text-blue-800 mt-2 space-y-1 ml-4 list-disc">
                                <li>Creates Supabase auth account with temporary password</li>
                                <li>Creates user profile marked as beta tester</li>
                                <li>Optionally creates company record</li>
                                <li>Sends welcome email with login instructions</li>
                                <li>Password is copied to your clipboard</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* ================================================================ */}
                {/* USERS TAB */}
                {/* ================================================================ */}
                {activeTab === 'users' && (
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* User List */}
                        <div>
                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                <h2 className="text-2xl font-bold text-slate-900 mb-4">Beta Testers</h2>

                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name or email..."
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                                />

                                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                    {users
                                        .filter(user =>
                                            searchQuery === '' ||
                                            user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            user.email.toLowerCase().includes(searchQuery.toLowerCase())
                                        )
                                        .map(user => (
                                            <button
                                                key={user.user_id}
                                                onClick={() => loadUserDetails(user.user_id)}
                                                className={`w-full text-left p-4 border-2 rounded-lg transition-all ${selectedUser?.profile.user_id === user.user_id
                                                        ? 'border-[#2563eb] bg-blue-50'
                                                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="font-semibold text-slate-900">
                                                    {user.first_name} {user.last_name}
                                                </div>
                                                <div className="text-sm text-slate-600">{user.email}</div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    Joined {new Date(user.created_at).toLocaleDateString()}
                                                </div>
                                            </button>
                                        ))}

                                    {users.length === 0 && (
                                        <div className="text-center py-8 text-slate-500">
                                            No beta testers found
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* User Details */}
                        <div>
                            {loadingUser ? (
                                <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                                    <div className="text-4xl mb-4 animate-pulse">⏳</div>
                                    <p className="text-slate-600">Loading user details...</p>
                                </div>
                            ) : selectedUser ? (
                                <div className="bg-white rounded-2xl shadow-lg p-6">
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4">
                                        {selectedUser.profile.first_name} {selectedUser.profile.last_name}
                                    </h2>

                                    <div className="space-y-4">
                                        {/* Profile Info */}
                                        <div className="space-y-1">
                                            <p className="text-sm text-slate-600">
                                                📧 {selectedUser.profile.email}
                                            </p>
                                            {selectedUser.company && (
                                                <p className="text-sm text-slate-600">
                                                    🏢 {selectedUser.company.company_name}
                                                </p>
                                            )}
                                            <p className="text-sm text-slate-600">
                                                📅 Joined {new Date(selectedUser.profile.created_at).toLocaleDateString()}
                                            </p>
                                            {selectedUser.profile.last_login_at && (
                                                <p className="text-sm text-slate-600">
                                                    🕐 Last login {new Date(selectedUser.profile.last_login_at).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>

                                        {/* Sessions Info */}
                                        {selectedUser.sessions.length > 0 ? (
                                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                <p className="font-semibold text-slate-900 mb-2">
                                                    📋 Sessions ({selectedUser.sessions.length})
                                                </p>
                                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                                    {selectedUser.sessions.map(session => (
                                                        <div key={session.session_id} className="text-sm">
                                                            <span className="font-medium">{session.session_name || 'Unnamed Session'}</span>
                                                            <span className="text-slate-500 ml-2">({session.status})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                <p className="text-slate-600">No sessions created yet</p>
                                            </div>
                                        )}

                                        {/* Feedback */}
                                        {selectedUser.feedback.length > 0 ? (
                                            <div>
                                                <h3 className="font-semibold text-slate-900 mb-2">💬 Feedback</h3>
                                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                                    {selectedUser.feedback.map(fb => (
                                                        <div key={fb.feedback_id} className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                                            <div className="flex items-start justify-between mb-1">
                                                                <span className="text-sm font-semibold text-emerald-900">
                                                                    {getFeedbackTypeIcon(fb.feedback_type)} {getFeedbackTypeLabel(fb.feedback_type)}
                                                                </span>
                                                                {fb.reviewed_at && (
                                                                    <span className="text-xs text-emerald-600">✅ Reviewed</span>
                                                                )}
                                                            </div>
                                                            {fb.title && (
                                                                <p className="text-sm font-medium text-slate-800">{fb.title}</p>
                                                            )}
                                                            <p className="text-sm text-slate-700 line-clamp-2">{fb.description}</p>
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                {new Date(fb.created_at).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                <p className="text-slate-600">No feedback submitted yet</p>
                                            </div>
                                        )}

                                        {/* Quick Actions */}
                                        <div className="pt-4 border-t border-slate-200 space-y-2">
                                            <button className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors">
                                                ✉️ Send Email
                                            </button>
                                            <button className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors">
                                                🔐 Reset Password
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                                    <div className="text-6xl mb-4">👈</div>
                                    <p className="text-slate-600">Select a user to view details</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ================================================================ */}
                {/* FEEDBACK TAB */}
                {/* ================================================================ */}
                {activeTab === 'feedback' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-slate-900">Beta Feedback</h2>

                                {/* Filter Buttons */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setFeedbackFilter('all')}
                                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${feedbackFilter === 'all'
                                                ? 'bg-[#2563eb] text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setFeedbackFilter('flagged')}
                                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${feedbackFilter === 'flagged'
                                                ? 'bg-red-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        🚩 Flagged
                                    </button>
                                    <button
                                        onClick={() => setFeedbackFilter('unreviewed')}
                                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${feedbackFilter === 'unreviewed'
                                                ? 'bg-amber-500 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        ⏳ Unreviewed
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4 max-h-[700px] overflow-y-auto">
                                {allFeedback.map(fb => (
                                    <div
                                        key={fb.feedback_id}
                                        className={`p-4 rounded-lg border-2 ${fb.is_flagged
                                                ? 'bg-red-50 border-red-300'
                                                : fb.reviewed_at
                                                    ? 'bg-slate-50 border-slate-200'
                                                    : 'bg-white border-blue-200'
                                            }`}
                                    >
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="font-semibold text-slate-900">
                                                    {fb.user?.first_name || 'Unknown'} {fb.user?.last_name || 'User'}
                                                </p>
                                                <p className="text-sm text-slate-600">
                                                    {fb.user?.email}
                                                </p>
                                                {fb.company?.company_name && (
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        🏢 {fb.company.company_name}
                                                    </p>
                                                )}
                                                {fb.page_url && (
                                                    <p className="text-xs text-blue-600 mt-1">
                                                        📍 {new URL(fb.page_url).pathname}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg" title={getFeedbackTypeLabel(fb.feedback_type)}>
                                                    {getFeedbackTypeIcon(fb.feedback_type)}
                                                </span>
                                                {fb.is_flagged && <span className="text-red-600">🚩</span>}
                                                {fb.reviewed_at && <span className="text-emerald-600">✅</span>}
                                            </div>
                                        </div>

                                        {/* Title & Description */}
                                        {fb.title && (
                                            <p className="font-medium text-slate-800 mb-1">{fb.title}</p>
                                        )}
                                        <p className="text-slate-700 mb-3">{fb.description}</p>

                                        {/* Priority Badge */}
                                        {fb.priority && (
                                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium border mb-3 ${getPriorityColor(fb.priority)}`}>
                                                {fb.priority.toUpperCase()}
                                            </span>
                                        )}

                                        {/* Admin Notes */}
                                        {fb.admin_notes && (
                                            <div className="p-2 bg-amber-50 border border-amber-200 rounded mb-3">
                                                <p className="text-xs font-semibold text-amber-900">Admin Notes:</p>
                                                <p className="text-sm text-amber-800">{fb.admin_notes}</p>
                                            </div>
                                        )}

                                        {/* Footer */}
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                                            <p className="text-xs text-slate-500">
                                                {new Date(fb.created_at).toLocaleDateString()} at {new Date(fb.created_at).toLocaleTimeString()}
                                            </p>

                                            <div className="flex gap-2">
                                                {/* Priority Selector */}
                                                <select
                                                    value={fb.priority || ''}
                                                    onChange={(e) => updateFeedbackPriority(fb.feedback_id, e.target.value)}
                                                    className="text-xs px-2 py-1 border border-slate-300 rounded bg-white"
                                                >
                                                    <option value="">Set Priority</option>
                                                    <option value="low">Low</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="high">High</option>
                                                    <option value="critical">Critical</option>
                                                </select>

                                                {/* Flag Button */}
                                                <button
                                                    onClick={() => toggleFeedbackFlag(fb.feedback_id, fb.is_flagged)}
                                                    className="text-sm px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded font-semibold"
                                                >
                                                    {fb.is_flagged ? '🚩 Unflag' : 'Flag'}
                                                </button>

                                                {/* Mark Reviewed Button */}
                                                {!fb.reviewed_at && (
                                                    <button
                                                        onClick={() => markFeedbackReviewed(fb.feedback_id)}
                                                        className="text-sm px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded font-semibold"
                                                    >
                                                        ✅ Mark Reviewed
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {allFeedback.length === 0 && (
                                    <div className="text-center py-12">
                                        <div className="text-6xl mb-4">💬</div>
                                        <p className="text-slate-600">No feedback yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ================================================================ */}
                {/* STATS TAB */}
                {/* ================================================================ */}
                {activeTab === 'stats' && (
                    <div className="max-w-5xl mx-auto">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">Beta Testing Dashboard</h2>

                        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
                            {/* Total Beta Testers */}
                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                <div className="text-4xl mb-2">👥</div>
                                <div className="text-3xl font-bold text-slate-900">{stats.totalBetaTesters}</div>
                                <div className="text-sm text-slate-600">Total Beta Testers</div>
                            </div>

                            {/* Active This Week */}
                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                <div className="text-4xl mb-2">🟢</div>
                                <div className="text-3xl font-bold text-slate-900">{stats.activeThisWeek}</div>
                                <div className="text-sm text-slate-600">Active This Week</div>
                            </div>

                            {/* Total Sessions */}
                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                <div className="text-4xl mb-2">📋</div>
                                <div className="text-3xl font-bold text-slate-900">{stats.totalSessions}</div>
                                <div className="text-sm text-slate-600">Total Sessions</div>
                            </div>

                            {/* Pending Feedback */}
                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                <div className="text-4xl mb-2">⏳</div>
                                <div className="text-3xl font-bold text-slate-900">{stats.pendingFeedback}</div>
                                <div className="text-sm text-slate-600">Pending Feedback</div>
                            </div>

                            {/* Average Rating */}
                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                <div className="text-4xl mb-2">⭐</div>
                                <div className="text-3xl font-bold text-slate-900">{stats.averageRating.toFixed(1)}</div>
                                <div className="text-sm text-slate-600">Average Rating</div>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    )
}