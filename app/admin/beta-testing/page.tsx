'use client'

// ============================================================================
// CLARENCE Beta Testing Admin Dashboard
// ============================================================================
// File: app/admin/beta-testing/page.tsx
// Purpose: Admin interface for managing beta testers, feedback, and videos
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

interface TrainingVideo {
    video_id: string
    video_code: string
    youtube_id: string | null
    title: string
    description: string | null
    duration: string | null
    thumbnail_url: string | null
    category: string
    placement: string[]
    priority: 'high' | 'medium' | 'low'
    status: 'placeholder' | 'scripted' | 'recorded' | 'published'
    script_notes: string | null
    is_active: boolean
    is_featured: boolean
    display_order: number
    created_at: string
    updated_at: string
    published_at: string | null
}

interface VideoStats {
    total: number
    published: number
    placeholder: number
    byCategory: Record<string, number>
}

// ============================================================================
// SECTION 1B: CONSTANTS
// ============================================================================

const VIDEO_CATEGORIES: Record<string, { label: string; icon: string; color: string }> = {
    onboarding: { label: 'Getting Started', icon: '👋', color: 'bg-blue-100 text-blue-700' },
    contract_creation: { label: 'Contract Creation', icon: '📝', color: 'bg-emerald-100 text-emerald-700' },
    contract_prep: { label: 'Contract Prep', icon: '📋', color: 'bg-purple-100 text-purple-700' },
    assessment: { label: 'Assessment', icon: '📊', color: 'bg-amber-100 text-amber-700' },
    provider: { label: 'Providers', icon: '🏢', color: 'bg-indigo-100 text-indigo-700' },
    negotiation: { label: 'Negotiation', icon: '⚖️', color: 'bg-rose-100 text-rose-700' },
    document_centre: { label: 'Documents', icon: '📁', color: 'bg-slate-100 text-slate-700' },
    training: { label: 'Training Mode', icon: '🎓', color: 'bg-orange-100 text-orange-700' }
}

const VIDEO_PRIORITIES: Record<string, { label: string; color: string }> = {
    high: { label: 'High', color: 'bg-red-100 text-red-700 border-red-300' },
    medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    low: { label: 'Low', color: 'bg-slate-100 text-slate-600 border-slate-300' }
}

const VIDEO_STATUSES: Record<string, { label: string; color: string }> = {
    placeholder: { label: 'Not Started', color: 'bg-slate-100 text-slate-600' },
    scripted: { label: 'Script Ready', color: 'bg-purple-100 text-purple-700' },
    recorded: { label: 'Recorded', color: 'bg-amber-100 text-amber-700' },
    published: { label: 'Published', color: 'bg-emerald-100 text-emerald-700' }
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

    // Tab state - Added 'videos' to the type
    const [activeTab, setActiveTab] = useState<'create' | 'users' | 'feedback' | 'stats' | 'videos'>('users')

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

    // Video state
    const [videos, setVideos] = useState<TrainingVideo[]>([])
    const [videoStats, setVideoStats] = useState<VideoStats>({ total: 0, published: 0, placeholder: 0, byCategory: {} })
    const [loadingVideos, setLoadingVideos] = useState(false)
    const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null)
    const [videoFilter, setVideoFilter] = useState<{ category: string; status: string; search: string }>({
        category: 'all',
        status: 'all',
        search: ''
    })
    const [editingYoutubeId, setEditingYoutubeId] = useState<string | null>(null)
    const [newYoutubeId, setNewYoutubeId] = useState('')
    const [showAddVideoModal, setShowAddVideoModal] = useState(false)
    const [newVideo, setNewVideo] = useState({
        video_code: '',
        title: '',
        description: '',
        duration: '',
        category: 'training',
        priority: 'medium',
        script_notes: ''
    })

    // -------------------------------------------------------------------------
    // SECTION 2.2: EFFECTS
    // -------------------------------------------------------------------------

    // Check admin access on mount
    useEffect(() => {
        checkAdminAccess()
    }, [])

    // Load feedback count on mount (for tab badge)
    useEffect(() => {
        if (isAdmin) {
            loadAllFeedback()
        }
    }, [isAdmin])

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
            const { data: { user }, error: authError } = await supabase.auth.getUser()
            console.log('🔍 Admin check - User:', user?.id, user?.email)

            if (authError) {
                console.error('❌ Auth error:', authError)
                router.push('/auth/login')
                return
            }

            if (!user) {
                console.log('❌ No user, redirecting to login')
                router.push('/auth/login')
                return
            }

            // Check if user has admin role - use auth_id to match RLS policy
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('role, email')
                .eq('auth_id', user.id)
                .single()

            console.log('🔍 Admin check - Profile:', profile)
            console.log('🔍 Admin check - Profile Error:', profileError)
            console.log('🔍 Admin check - Role:', profile?.role)

            if (profileError) {
                console.error('❌ Profile fetch error:', profileError)
                router.push('/auth/contracts-dashboard')
                return
            }

            if (profile?.role === 'admin') {
                console.log('✅ User is admin!')
                setIsAdmin(true)
                setAdminEmail(profile.email)
            } else {
                console.log('❌ User is NOT admin, redirecting')
                router.push('/auth/contracts-dashboard')
            }
        } catch (error) {
            console.error('Admin access check failed:', error)
            router.push('/auth/contracts-dashboard')
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
            // Show all users, not just beta testers - any feedback is valuable
            const { data } = await supabase
                .from('users')
                .select('*')
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
            // First, get all feedback
            let query = supabase
                .from('beta_feedback')
                .select('*')
                .order('created_at', { ascending: false })

            if (feedbackFilter === 'flagged') {
                query = query.eq('is_flagged', true)
            } else if (feedbackFilter === 'unreviewed') {
                query = query.is('reviewed_at', null)
            }

            const { data: feedbackData, error: feedbackError } = await query

            if (feedbackError) {
                console.error('Error fetching feedback:', feedbackError)
                return
            }

            if (!feedbackData || feedbackData.length === 0) {
                setAllFeedback([])
                return
            }

            // Get unique user IDs and company IDs
            const userIds = [...new Set(feedbackData.map(f => f.user_id).filter(Boolean))]
            const companyIds = [...new Set(feedbackData.map(f => f.company_id).filter(Boolean))]

            // Fetch users
            let usersMap: Record<string, any> = {}
            if (userIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('user_id, first_name, last_name, email')
                    .in('user_id', userIds)

                if (usersData) {
                    usersData.forEach(u => {
                        usersMap[u.user_id] = u
                    })
                }
            }

            // Fetch companies
            let companiesMap: Record<string, any> = {}
            if (companyIds.length > 0) {
                const { data: companiesData } = await supabase
                    .from('companies')
                    .select('company_id, company_name')
                    .in('company_id', companyIds)

                if (companiesData) {
                    companiesData.forEach(c => {
                        companiesMap[c.company_id] = c
                    })
                }
            }

            // Combine the data
            const enrichedFeedback = feedbackData.map(fb => ({
                ...fb,
                user: fb.user_id ? usersMap[fb.user_id] : null,
                company: fb.company_id ? companiesMap[fb.company_id] : null
            }))

            setAllFeedback(enrichedFeedback)

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
    // SECTION 2.8: VIDEO FUNCTIONS
    // -------------------------------------------------------------------------

    async function loadVideos() {
        setLoadingVideos(true)
        try {
            const { data, error } = await supabase
                .from('training_videos')
                .select('*')
                .order('display_order', { ascending: true })

            if (error) throw error

            setVideos(data || [])

            // Calculate stats
            const calcStats: VideoStats = {
                total: data?.length || 0,
                published: data?.filter(v => v.youtube_id).length || 0,
                placeholder: data?.filter(v => !v.youtube_id).length || 0,
                byCategory: {}
            }

            data?.forEach(v => {
                calcStats.byCategory[v.category] = (calcStats.byCategory[v.category] || 0) + 1
            })

            setVideoStats(calcStats)

        } catch (error) {
            console.error('Error loading videos:', error)
        } finally {
            setLoadingVideos(false)
        }
    }

    async function updateVideoYoutubeId(videoId: string, youtubeId: string) {
        try {
            const adminUser = await supabase.auth.getUser()

            const { error } = await supabase
                .from('training_videos')
                .update({
                    youtube_id: youtubeId || null,
                    status: youtubeId ? 'published' : 'placeholder',
                    published_at: youtubeId ? new Date().toISOString() : null,
                    updated_by: adminUser.data.user?.id
                })
                .eq('video_id', videoId)

            if (error) throw error

            // Log admin action
            await supabase.from('admin_actions').insert({
                admin_id: adminUser.data.user?.id,
                admin_email: adminEmail,
                action_type: 'update_video',
                details: { video_id: videoId, youtube_id: youtubeId }
            })

            setEditingYoutubeId(null)
            setNewYoutubeId('')
            loadVideos()

        } catch (error) {
            console.error('Error updating video:', error)
            alert('Failed to update video')
        }
    }

    async function toggleVideoFeatured(videoId: string, currentFeatured: boolean) {
        try {
            const { error } = await supabase
                .from('training_videos')
                .update({ is_featured: !currentFeatured })
                .eq('video_id', videoId)

            if (error) throw error
            loadVideos()

        } catch (error) {
            console.error('Error toggling featured:', error)
        }
    }

    async function toggleVideoActive(videoId: string, currentActive: boolean) {
        try {
            const { error } = await supabase
                .from('training_videos')
                .update({ is_active: !currentActive })
                .eq('video_id', videoId)

            if (error) throw error
            loadVideos()

        } catch (error) {
            console.error('Error toggling active:', error)
        }
    }

    async function createNewVideo() {
        if (!newVideo.video_code || !newVideo.title) {
            alert('Please fill in video code and title')
            return
        }

        try {
            const adminUser = await supabase.auth.getUser()

            const { error } = await supabase
                .from('training_videos')
                .insert({
                    video_code: newVideo.video_code,
                    title: newVideo.title,
                    description: newVideo.description || null,
                    duration: newVideo.duration || null,
                    category: newVideo.category,
                    priority: newVideo.priority,
                    script_notes: newVideo.script_notes || null,
                    created_by: adminUser.data.user?.id
                })

            if (error) throw error

            setShowAddVideoModal(false)
            setNewVideo({
                video_code: '',
                title: '',
                description: '',
                duration: '',
                category: 'training',
                priority: 'medium',
                script_notes: ''
            })
            loadVideos()

        } catch (error: any) {
            console.error('Error creating video:', error)
            alert(`Failed to create video: ${error.message}`)
        }
    }

    function getFilteredVideos() {
        return videos.filter(v => {
            if (videoFilter.category !== 'all' && v.category !== videoFilter.category) return false
            if (videoFilter.status !== 'all') {
                if (videoFilter.status === 'published' && !v.youtube_id) return false
                if (videoFilter.status === 'placeholder' && v.youtube_id) return false
            }
            if (videoFilter.search) {
                const search = videoFilter.search.toLowerCase()
                if (!v.title.toLowerCase().includes(search) &&
                    !v.video_code.toLowerCase().includes(search) &&
                    !v.description?.toLowerCase().includes(search)) return false
            }
            return true
        })
    }

    // -------------------------------------------------------------------------
    // SECTION 2.9: LOADING STATE
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
    // SECTION 3: MAIN RENDER
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
                                href="/auth/contracts-dashboard"
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
                            👥 Users ({users.length})
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

                        {/* Videos Tab */}
                        <button
                            onClick={() => setActiveTab('videos')}
                            className={`py-4 px-2 border-b-2 font-semibold transition-colors ${activeTab === 'videos'
                                ? 'border-[#2563eb] text-[#2563eb]'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            🎬 Videos ({videoStats.published}/{videoStats.total})
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

                {/* ================================================================ */}
                {/* VIDEOS TAB */}
                {/* ================================================================ */}
                {activeTab === 'videos' && (
                    <div className="max-w-6xl mx-auto">
                        {/* Stats Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-white rounded-xl shadow p-4">
                                <div className="text-3xl font-bold text-slate-800">{videoStats.total}</div>
                                <div className="text-sm text-slate-500">Total Videos</div>
                            </div>
                            <div className="bg-white rounded-xl shadow p-4">
                                <div className="text-3xl font-bold text-emerald-600">{videoStats.published}</div>
                                <div className="text-sm text-slate-500">Published</div>
                            </div>
                            <div className="bg-white rounded-xl shadow p-4">
                                <div className="text-3xl font-bold text-amber-600">{videoStats.placeholder}</div>
                                <div className="text-sm text-slate-500">To Record</div>
                            </div>
                            <div className="bg-white rounded-xl shadow p-4">
                                <div className="text-3xl font-bold text-red-600">
                                    {videos.filter(v => v.priority === 'high' && !v.youtube_id).length}
                                </div>
                                <div className="text-sm text-slate-500">High Priority Pending</div>
                            </div>
                        </div>

                        {/* Category Pills */}
                        <div className="bg-white rounded-xl shadow p-4 mb-6">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setVideoFilter(f => ({ ...f, category: 'all' }))}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${videoFilter.category === 'all'
                                        ? 'bg-slate-800 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    All ({videoStats.total})
                                </button>
                                {Object.entries(VIDEO_CATEGORIES).map(([key, cat]) => (
                                    <button
                                        key={key}
                                        onClick={() => setVideoFilter(f => ({ ...f, category: key }))}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${videoFilter.category === key
                                            ? 'bg-slate-800 text-white'
                                            : `${cat.color} hover:opacity-80`
                                            }`}
                                    >
                                        {cat.icon} {cat.label} ({videoStats.byCategory[key] || 0})
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Filters & Actions */}
                        <div className="bg-white rounded-xl shadow p-4 mb-6">
                            <div className="flex flex-wrap items-center gap-4">
                                <input
                                    type="text"
                                    placeholder="Search videos..."
                                    value={videoFilter.search}
                                    onChange={(e) => setVideoFilter(f => ({ ...f, search: e.target.value }))}
                                    className="flex-1 min-w-[200px] px-4 py-2 border border-slate-300 rounded-lg"
                                />
                                <select
                                    value={videoFilter.status}
                                    onChange={(e) => setVideoFilter(f => ({ ...f, status: e.target.value }))}
                                    className="px-3 py-2 border border-slate-300 rounded-lg"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="placeholder">🔴 Not Published</option>
                                    <option value="published">🟢 Published</option>
                                </select>
                                <button
                                    onClick={() => setShowAddVideoModal(true)}
                                    className="px-4 py-2 bg-[#2563eb] text-white rounded-lg font-medium hover:bg-[#1d4ed8]"
                                >
                                    + Add Video
                                </button>
                            </div>
                        </div>

                        {/* Video List */}
                        <div className="bg-white rounded-xl shadow overflow-hidden">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                <span className="font-medium text-slate-700">
                                    {getFilteredVideos().length} video{getFilteredVideos().length !== 1 ? 's' : ''}
                                </span>
                                <button
                                    onClick={loadVideos}
                                    className="text-sm text-blue-600 hover:text-blue-700"
                                >
                                    🔄 Refresh
                                </button>
                            </div>

                            {loadingVideos ? (
                                <div className="p-12 text-center">
                                    <div className="text-4xl mb-4 animate-pulse">⏳</div>
                                    <p className="text-slate-600">Loading videos...</p>
                                </div>
                            ) : getFilteredVideos().length === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="text-4xl mb-4">🎬</div>
                                    <p className="text-slate-600">No videos match your filters</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {getFilteredVideos().map(video => (
                                        <div key={video.video_id} className="p-4 hover:bg-slate-50">
                                            <div className="flex items-start gap-4">
                                                {/* Thumbnail / Preview */}
                                                <div className="flex-shrink-0">
                                                    {video.youtube_id ? (
                                                        <a
                                                            href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="block w-32 h-20 rounded-lg overflow-hidden bg-slate-200 relative group"
                                                        >
                                                            <img
                                                                src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                                                                alt={video.title}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <span className="text-white text-2xl">▶</span>
                                                            </div>
                                                        </a>
                                                    ) : (
                                                        <div className="w-32 h-20 rounded-lg bg-slate-200 flex items-center justify-center">
                                                            <span className="text-3xl">{VIDEO_CATEGORIES[video.category]?.icon || '🎬'}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <h4 className="font-semibold text-slate-800">{video.title}</h4>
                                                        {video.is_featured && (
                                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">⭐ Featured</span>
                                                        )}
                                                        {!video.is_active && (
                                                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Hidden</span>
                                                        )}
                                                    </div>

                                                    <p className="text-sm text-slate-600 mb-2 line-clamp-1">
                                                        {video.description || 'No description'}
                                                    </p>

                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${VIDEO_CATEGORIES[video.category]?.color || 'bg-slate-100'}`}>
                                                            {VIDEO_CATEGORIES[video.category]?.label || video.category}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${VIDEO_PRIORITIES[video.priority]?.color}`}>
                                                            {VIDEO_PRIORITIES[video.priority]?.label}
                                                        </span>
                                                        <span className="text-xs text-slate-500">
                                                            {video.duration}
                                                        </span>
                                                        <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                                            {video.video_code}
                                                        </code>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex-shrink-0 space-y-2">
                                                    {/* YouTube ID Input */}
                                                    {editingYoutubeId === video.video_id ? (
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={newYoutubeId}
                                                                onChange={(e) => setNewYoutubeId(e.target.value)}
                                                                placeholder="YouTube ID"
                                                                className="w-32 px-2 py-1 text-sm border border-slate-300 rounded"
                                                                autoFocus
                                                            />
                                                            <button
                                                                onClick={() => updateVideoYoutubeId(video.video_id, newYoutubeId)}
                                                                className="px-2 py-1 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={() => { setEditingYoutubeId(null); setNewYoutubeId(''); }}
                                                                className="px-2 py-1 bg-slate-200 text-slate-700 text-sm rounded hover:bg-slate-300"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                setEditingYoutubeId(video.video_id)
                                                                setNewYoutubeId(video.youtube_id || '')
                                                            }}
                                                            className={`px-3 py-1.5 text-sm rounded font-medium ${video.youtube_id
                                                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                                                }`}
                                                        >
                                                            {video.youtube_id ? '✏️ Edit ID' : '➕ Add YouTube ID'}
                                                        </button>
                                                    )}

                                                    {/* Quick Actions */}
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => toggleVideoFeatured(video.video_id, video.is_featured)}
                                                            className={`px-2 py-1 text-xs rounded ${video.is_featured
                                                                ? 'bg-amber-500 text-white'
                                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                                }`}
                                                            title={video.is_featured ? 'Remove from featured' : 'Add to featured'}
                                                        >
                                                            ⭐
                                                        </button>
                                                        <button
                                                            onClick={() => toggleVideoActive(video.video_id, video.is_active)}
                                                            className={`px-2 py-1 text-xs rounded ${video.is_active
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-red-100 text-red-700'
                                                                }`}
                                                            title={video.is_active ? 'Hide video' : 'Show video'}
                                                        >
                                                            {video.is_active ? '👁️' : '🚫'}
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedVideo(video)}
                                                            className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                            title="View details"
                                                        >
                                                            ℹ️
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Script Notes (expandable) */}
                                            {video.script_notes && (
                                                <details className="mt-3 ml-36">
                                                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                                                        📝 Script Notes
                                                    </summary>
                                                    <p className="mt-2 text-sm text-slate-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                                                        {video.script_notes}
                                                    </p>
                                                </details>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Add Video Modal */}
                        {showAddVideoModal && (
                            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
                                    <div className="p-6 border-b border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold text-slate-800">Add New Video</h3>
                                            <button
                                                onClick={() => setShowAddVideoModal(false)}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Video Code <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={newVideo.video_code}
                                                onChange={(e) => setNewVideo(v => ({ ...v, video_code: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                                                placeholder="e.g., training-new-feature"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                            />
                                            <p className="text-xs text-slate-500 mt-1">Unique identifier (lowercase, hyphens)</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Title <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={newVideo.title}
                                                onChange={(e) => setNewVideo(v => ({ ...v, title: e.target.value }))}
                                                placeholder="Video title"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                            <textarea
                                                value={newVideo.description}
                                                onChange={(e) => setNewVideo(v => ({ ...v, description: e.target.value }))}
                                                placeholder="Brief description..."
                                                rows={2}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
                                                <input
                                                    type="text"
                                                    value={newVideo.duration}
                                                    onChange={(e) => setNewVideo(v => ({ ...v, duration: e.target.value }))}
                                                    placeholder="e.g., 60-90s"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                                <select
                                                    value={newVideo.category}
                                                    onChange={(e) => setNewVideo(v => ({ ...v, category: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                >
                                                    {Object.entries(VIDEO_CATEGORIES).map(([key, cat]) => (
                                                        <option key={key} value={key}>{cat.icon} {cat.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                                            <div className="flex gap-2">
                                                {Object.entries(VIDEO_PRIORITIES).map(([key, pri]) => (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => setNewVideo(v => ({ ...v, priority: key }))}
                                                        className={`px-4 py-2 rounded-lg border font-medium ${newVideo.priority === key
                                                            ? pri.color + ' border-current'
                                                            : 'bg-white border-slate-300 text-slate-600'
                                                            }`}
                                                    >
                                                        {pri.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Script Notes</label>
                                            <textarea
                                                value={newVideo.script_notes}
                                                onChange={(e) => setNewVideo(v => ({ ...v, script_notes: e.target.value }))}
                                                placeholder="Notes on what to cover in this video..."
                                                rows={3}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                                        <button
                                            onClick={() => setShowAddVideoModal(false)}
                                            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={createNewVideo}
                                            className="px-4 py-2 bg-[#2563eb] text-white rounded-lg font-medium hover:bg-[#1d4ed8]"
                                        >
                                            Create Video
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Video Details Modal */}
                        {selectedVideo && (
                            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
                                    <div className="p-6 border-b border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold text-slate-800">{selectedVideo.title}</h3>
                                            <button
                                                onClick={() => setSelectedVideo(null)}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-6">
                                        {/* Preview */}
                                        {selectedVideo.youtube_id ? (
                                            <div className="aspect-video mb-6 rounded-lg overflow-hidden bg-black">
                                                <iframe
                                                    src={`https://www.youtube.com/embed/${selectedVideo.youtube_id}`}
                                                    title={selectedVideo.title}
                                                    className="w-full h-full"
                                                    allowFullScreen
                                                />
                                            </div>
                                        ) : (
                                            <div className="aspect-video mb-6 rounded-lg bg-slate-100 flex items-center justify-center">
                                                <div className="text-center">
                                                    <div className="text-6xl mb-4">{VIDEO_CATEGORIES[selectedVideo.category]?.icon || '🎬'}</div>
                                                    <p className="text-slate-500">No video uploaded yet</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Details */}
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-sm font-medium text-slate-500">Description</h4>
                                                <p className="text-slate-800">{selectedVideo.description || 'No description'}</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <h4 className="text-sm font-medium text-slate-500">Video Code</h4>
                                                    <code className="text-sm bg-slate-100 px-2 py-1 rounded">{selectedVideo.video_code}</code>
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-medium text-slate-500">Duration</h4>
                                                    <p className="text-slate-800">{selectedVideo.duration || 'Not set'}</p>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-sm font-medium text-slate-500">Placements</h4>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {selectedVideo.placement?.map((p, i) => (
                                                        <span key={i} className="px-2 py-1 bg-slate-100 text-slate-700 text-sm rounded">
                                                            {p}
                                                        </span>
                                                    ))}
                                                    {(!selectedVideo.placement || selectedVideo.placement.length === 0) && (
                                                        <span className="text-slate-400 text-sm">No placements configured</span>
                                                    )}
                                                </div>
                                            </div>

                                            {selectedVideo.script_notes && (
                                                <div>
                                                    <h4 className="text-sm font-medium text-slate-500">Script Notes</h4>
                                                    <p className="text-slate-800 bg-amber-50 p-3 rounded-lg border border-amber-200 mt-1">
                                                        {selectedVideo.script_notes}
                                                    </p>
                                                </div>
                                            )}

                                            <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
                                                <p>Created: {new Date(selectedVideo.created_at).toLocaleString()}</p>
                                                <p>Updated: {new Date(selectedVideo.updated_at).toLocaleString()}</p>
                                                {selectedVideo.published_at && (
                                                    <p>Published: {new Date(selectedVideo.published_at).toLocaleString()}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </main>
        </div>
    )
}