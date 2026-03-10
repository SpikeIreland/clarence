'use client'

// ============================================================================
// CLARENCE Training Dashboard — Simplified v5.0
// ============================================================================
// File: /app/auth/training/page.tsx
// Purpose: Clean training dashboard showing session history, scores, and
//          a "New Session" button that routes to the Clarence-driven studio
// ============================================================================

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================

interface UserInfo {
    firstName?: string
    lastName?: string
    email?: string
    company?: string
    companyId?: string
    role?: string
    userId?: string
}

interface TrainingSession {
    sessionId: string
    sessionNumber: string
    counterpartyName: string
    contractType: string
    status: string
    createdAt: string
    lastActivityAt: string
    overallScore: number | null
}

interface TrainingVideo {
    videoId: string
    videoCode: string
    title: string
    description: string
    category: string
    youtubeId: string | null
    duration: number
    priority: 'high' | 'medium' | 'low'
    isPublished: boolean
    sortOrder: number
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const VIDEO_CATEGORIES: Record<string, { label: string; icon: string }> = {
    'getting-started': { label: 'Getting Started', icon: '👋' },
    'contract-creation': { label: 'Contract Creation', icon: '📝' },
    'contract-preparation': { label: 'Contract Preparation', icon: '📋' },
    'negotiation': { label: 'Negotiation', icon: '🤝' },
    'training': { label: 'Training Mode', icon: '🎓' },
    'documents': { label: 'Documents', icon: '📄' },
    'admin': { label: 'Administration', icon: '⚙️' }
}

// ============================================================================
// SECTION 3: HELPER FUNCTIONS
// ============================================================================

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getStatusBadge(status: string): { label: string; className: string } {
    const statusMap: Record<string, { label: string; className: string }> = {
        'created': { label: 'Draft', className: 'bg-slate-100 text-slate-600' },
        'initiated': { label: 'Draft', className: 'bg-slate-100 text-slate-600' },
        'negotiation_ready': { label: 'In Progress', className: 'bg-amber-100 text-amber-700' },
        'in_progress': { label: 'In Progress', className: 'bg-amber-100 text-amber-700' },
        'completed': { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
    }
    return statusMap[status] || { label: status.replace(/_/g, ' '), className: 'bg-slate-100 text-slate-600' }
}

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

function TrainingDashboardPage() {
    const router = useRouter()
    const supabase = createClient()

    // State
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [sessions, setSessions] = useState<TrainingSession[]>([])
    const [activeTab, setActiveTab] = useState<'sessions' | 'videos'>('sessions')

    // Videos
    const [videos, setVideos] = useState<TrainingVideo[]>([])
    const [loadingVideos, setLoadingVideos] = useState(false)
    const [videoCategory, setVideoCategory] = useState<string>('all')

    // ========================================================================
    // SECTION 5: DATA LOADING
    // ========================================================================

    const loadUserInfo = useCallback(async () => {
        const auth = localStorage.getItem('clarence_auth')
        if (!auth) { router.push('/auth/login'); return }
        const authData = JSON.parse(auth)
        setUserInfo(authData.userInfo)
    }, [router])

    const loadSessions = useCallback(async () => {
        try {
            const auth = localStorage.getItem('clarence_auth')
            if (!auth) return
            const authData = JSON.parse(auth)
            const userId = authData.userInfo?.userId

            // Load training sessions
            const { data: sessionsData } = await supabase
                .from('sessions')
                .select('*')
                .eq('is_training', true)
                .eq('customer_id', userId)
                .order('updated_at', { ascending: false })
                .limit(50)

            if (!sessionsData) { setSessions([]); return }

            // Load scores from training_session_results
            const sessionIds = sessionsData.map((s: Record<string, unknown>) => s.session_id as string)
            let scoresMap: Record<string, number> = {}

            if (sessionIds.length > 0) {
                const { data: scoresData } = await supabase
                    .from('training_session_results')
                    .select('session_id, overall_score')
                    .in('session_id', sessionIds)

                if (scoresData) {
                    scoresMap = Object.fromEntries(
                        scoresData.map((r: Record<string, unknown>) => [r.session_id, r.overall_score as number])
                    )
                }
            }

            const mapped: TrainingSession[] = sessionsData.map((s: Record<string, unknown>) => {
                // Extract counterparty name from notes or provider_company
                const notes = (s.notes as string) || ''
                const providerCompany = (s.provider_company as string) || ''
                let counterpartyName = 'AI Counterpart'

                // Parse from notes format: "Dynamic Training | AI: balanced | Opponent: Marcus Chen | Company: Apex Mfg"
                const opponentMatch = notes.match(/Opponent:\s*([^|]+)/)
                if (opponentMatch) {
                    counterpartyName = opponentMatch[1].trim()
                } else if (providerCompany) {
                    counterpartyName = providerCompany
                } else {
                    // Legacy format: "Training scenario: ..."
                    const scenarioMatch = notes.match(/Training scenario:\s*(.+)/)
                    if (scenarioMatch) {
                        counterpartyName = scenarioMatch[1].trim()
                    }
                }

                return {
                    sessionId: s.session_id as string,
                    sessionNumber: (s.session_number as string) || '',
                    counterpartyName,
                    contractType: (s.service_required as string) || (s.contract_type as string) || 'General',
                    status: s.status as string,
                    createdAt: s.created_at as string,
                    lastActivityAt: (s.updated_at as string) || (s.created_at as string),
                    overallScore: scoresMap[s.session_id as string] || null,
                }
            })

            setSessions(mapped)
        } catch (error) {
            console.error('Error loading training sessions:', error)
            setSessions([])
        } finally {
            setLoading(false)
        }
    }, [supabase])

    const loadVideos = useCallback(async () => {
        setLoadingVideos(true)
        try {
            const { data, error } = await supabase
                .from('training_videos')
                .select('*')
                .eq('is_published', true)
                .order('sort_order', { ascending: true })

            if (data && !error) {
                const mapped: TrainingVideo[] = data.map((v: Record<string, unknown>) => ({
                    videoId: v.video_id as string,
                    videoCode: (v.video_code as string) || '',
                    title: v.title as string,
                    description: (v.description as string) || '',
                    category: (v.category as string) || 'general',
                    youtubeId: v.youtube_id as string | null,
                    duration: (v.duration_seconds as number) || 60,
                    priority: (v.priority as 'high' | 'medium' | 'low') || 'medium',
                    isPublished: v.is_published as boolean,
                    sortOrder: (v.sort_order as number) || 0,
                }))
                setVideos(mapped)
            }
        } catch (error) {
            console.error('Error loading videos:', error)
        } finally {
            setLoadingVideos(false)
        }
    }, [supabase])

    // ========================================================================
    // SECTION 6: EFFECTS
    // ========================================================================

    useEffect(() => {
        loadUserInfo()
        loadSessions()
    }, [loadUserInfo, loadSessions])

    useEffect(() => {
        if (activeTab === 'videos' && videos.length === 0) {
            loadVideos()
        }
    }, [activeTab, videos.length, loadVideos])

    // ========================================================================
    // SECTION 7: COMPUTED VALUES
    // ========================================================================

    const activeSessions = sessions.filter(s => s.status !== 'completed').length
    const completedSessions = sessions.filter(s => s.status === 'completed').length
    const scoredSessions = sessions.filter(s => s.overallScore !== null)
    const avgScore = scoredSessions.length > 0
        ? Math.round(scoredSessions.reduce((sum, s) => sum + (s.overallScore || 0), 0) / scoredSessions.length)
        : null

    const filteredVideos = videoCategory === 'all'
        ? videos
        : videos.filter(v => v.category === videoCategory)

    // ========================================================================
    // SECTION 8: HANDLERS
    // ========================================================================

    const handleSignOut = async () => {
        try {
            await supabase.auth.signOut()
        } catch { /* ignore */ }
        localStorage.removeItem('clarence_auth')
        router.push('/auth/login')
    }

    const handleContinueSession = (sessionId: string) => {
        router.push(`/auth/contract-studio?session_id=${sessionId}`)
    }

    const handleNewSession = () => {
        router.push('/auth/training/new')
    }

    const handleDeleteSession = async (sessionId: string) => {
        if (!confirm('Delete this training session? This cannot be undone.')) return

        const auth = localStorage.getItem('clarence_auth')
        if (!auth) return
        const authData = JSON.parse(auth)
        const userId = authData.userInfo?.userId

        try {
            const res = await fetch('/api/agents/training-orchestrator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete-session', userId, sessionId }),
            })
            const result = await res.json()

            if (result.success) {
                setSessions(prev => prev.filter(s => s.sessionId !== sessionId))
            } else {
                alert('Failed to delete the session. Please try again.')
            }
        } catch (err) {
            console.error('Error deleting session:', err)
            alert('Failed to delete the session. Please try again.')
        }
    }

    // ========================================================================
    // SECTION 9: RENDER - LOADING
    // ========================================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 text-sm">Loading Training Dashboard...</p>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 10: RENDER - MAIN
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-50">
            <AuthenticatedHeader activePage="training" userInfo={userInfo} onSignOut={handleSignOut} />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Welcome Banner */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">
                            Training Dashboard
                        </h1>
                        <p className="text-slate-500 text-sm">
                            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <button
                        onClick={handleNewSession}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm transition-all flex items-center gap-2 shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New Training Session
                    </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-slate-800">{sessions.length}</div>
                                <div className="text-slate-500 text-xs">Total Sessions</div>
                            </div>
                            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-amber-600">{activeSessions}</div>
                                <div className="text-slate-500 text-xs">Active</div>
                            </div>
                            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-emerald-600">{completedSessions}</div>
                                <div className="text-slate-500 text-xs">Completed</div>
                            </div>
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-purple-600">{avgScore !== null ? avgScore : '—'}</div>
                                <div className="text-slate-500 text-xs">Avg Score</div>
                            </div>
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="border-b border-slate-200">
                        <div className="flex">
                            <button
                                onClick={() => setActiveTab('sessions')}
                                className={`px-6 py-4 font-medium text-sm transition-colors ${
                                    activeTab === 'sessions'
                                        ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/50'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Training Sessions
                                {sessions.length > 0 && (
                                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                                        activeTab === 'sessions' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {sessions.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('videos')}
                                className={`px-6 py-4 font-medium text-sm transition-colors ${
                                    activeTab === 'videos'
                                        ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/50'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Videos
                            </button>
                        </div>
                    </div>

                    {/* Sessions Tab */}
                    {activeTab === 'sessions' && (
                        <div className="p-6">
                            {sessions.length === 0 ? (
                                /* Empty State */
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="text-3xl">🎓</span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-800 mb-2">
                                        No training sessions yet
                                    </h3>
                                    <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
                                        Start your first training session. Clarence will design a scenario tailored to your experience
                                        and create a unique AI counterpart for you to negotiate with.
                                    </p>
                                    <button
                                        onClick={handleNewSession}
                                        className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2 mx-auto"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Start Your First Session
                                    </button>
                                </div>
                            ) : (
                                /* Session List */
                                <div className="space-y-3">
                                    {sessions.map(session => {
                                        const badge = getStatusBadge(session.status)
                                        const isCompleted = session.status === 'completed'

                                        return (
                                            <div
                                                key={session.sessionId}
                                                className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between hover:border-amber-300 hover:shadow-sm transition-all"
                                            >
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div className="w-11 h-11 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                        <span className="text-lg">🎯</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="font-medium text-slate-800 truncate">
                                                            {session.counterpartyName}
                                                        </h4>
                                                        <p className="text-sm text-slate-500 truncate">
                                                            {session.contractType} &bull; {formatDate(session.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                                    {/* Score */}
                                                    {session.overallScore !== null && (
                                                        <div className="text-center">
                                                            <div className={`text-sm font-bold ${
                                                                session.overallScore >= 70 ? 'text-emerald-600' :
                                                                session.overallScore >= 50 ? 'text-amber-600' :
                                                                'text-red-600'
                                                            }`}>
                                                                {session.overallScore}
                                                            </div>
                                                            <div className="text-xs text-slate-400">score</div>
                                                        </div>
                                                    )}

                                                    {/* Status Badge */}
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                                                        {badge.label}
                                                    </span>

                                                    {/* Action Buttons */}
                                                    <button
                                                        onClick={() => handleContinueSession(session.sessionId)}
                                                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
                                                    >
                                                        {isCompleted ? 'Review' : 'Continue'}
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.sessionId) }}
                                                        className="px-2.5 py-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete session"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Videos Tab */}
                    {activeTab === 'videos' && (
                        <div className="p-6">
                            {/* Category Filter */}
                            <div className="flex gap-2 mb-6 flex-wrap">
                                <button
                                    onClick={() => setVideoCategory('all')}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        videoCategory === 'all'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                    }`}
                                >
                                    All
                                </button>
                                {Object.entries(VIDEO_CATEGORIES).map(([key, cat]) => (
                                    <button
                                        key={key}
                                        onClick={() => setVideoCategory(key)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                            videoCategory === key
                                                ? 'bg-amber-500 text-white'
                                                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                        }`}
                                    >
                                        {cat.icon} {cat.label}
                                    </button>
                                ))}
                            </div>

                            {/* Videos Grid */}
                            {loadingVideos ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
                                            <div className="aspect-video bg-slate-200 rounded-lg mb-4" />
                                            <div className="h-5 bg-slate-200 rounded w-3/4 mb-2" />
                                            <div className="h-3 bg-slate-200 rounded w-full" />
                                        </div>
                                    ))}
                                </div>
                            ) : filteredVideos.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredVideos.map(video => (
                                        <div key={video.videoId} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                                            {video.youtubeId ? (
                                                <div
                                                    className="aspect-video bg-slate-900 relative cursor-pointer group"
                                                    onClick={() => window.open(`https://www.youtube.com/watch?v=${video.youtubeId}`, '_blank')}
                                                >
                                                    <img
                                                        src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                                                        alt={video.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                                        <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                                            <svg className="w-6 h-6 text-slate-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                                                                <path d="M8 5v14l11-7z" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="aspect-video bg-slate-100 flex items-center justify-center">
                                                    <div className="text-center">
                                                        <span className="text-3xl">🎬</span>
                                                        <p className="text-xs text-slate-400 mt-1">Coming Soon</p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="p-4">
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <h4 className="font-semibold text-slate-800 text-sm line-clamp-2">{video.title}</h4>
                                                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                                                        video.priority === 'high' ? 'bg-red-100 text-red-700' :
                                                        video.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {video.priority === 'high' ? '🔴' : video.priority === 'medium' ? '🔵' : '⚪'}
                                                    </span>
                                                </div>
                                                {video.description && (
                                                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{video.description}</p>
                                                )}
                                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                                    <span>{Math.round(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</span>
                                                    <span className="capitalize">{VIDEO_CATEGORIES[video.category]?.label || video.category}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                                    <div className="text-4xl mb-4">📹</div>
                                    <h3 className="text-lg font-semibold text-slate-800 mb-2">No Videos Available Yet</h3>
                                    <p className="text-slate-500 max-w-md mx-auto text-sm">
                                        Training videos are being produced. Check back soon for tutorials on negotiation techniques,
                                        platform features, and best practices.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 11: SUSPENSE WRAPPER
// ============================================================================

export default function TrainingDashboardWrapper() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <TrainingDashboardPage />
        </Suspense>
    )
}
