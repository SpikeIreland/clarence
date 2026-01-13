'use client'

// ============================================================================
// CLARENCE VIDEO MANAGEMENT PAGE
// ============================================================================
// Admin page to view all videos, their status, and production notes.
// This helps John know which videos to create and their priority.
// ============================================================================

import { useState } from 'react'
import {
    VIDEO_LIBRARY,
    CATEGORY_LABELS,
    CATEGORY_ICONS,
    getVideoStats,
    VideoMetadata,
    VideoCategory
} from '@/lib/video/videoLibrary'

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

type SortField = 'priority' | 'category' | 'title' | 'status'
type SortOrder = 'asc' | 'desc'

// ============================================================================
// SECTION 2: PRIORITY CONFIG
// ============================================================================

const PRIORITY_CONFIG = {
    high: { label: 'High Priority', color: 'bg-red-100 text-red-700', sortOrder: 1 },
    medium: { label: 'Medium Priority', color: 'bg-blue-100 text-blue-700', sortOrder: 2 },
    low: { label: 'Low Priority', color: 'bg-slate-100 text-slate-600', sortOrder: 3 }
}

const STATUS_CONFIG = {
    placeholder: { label: 'Not Started', color: 'bg-amber-100 text-amber-700' },
    scripted: { label: 'Script Ready', color: 'bg-purple-100 text-purple-700' },
    recorded: { label: 'Recorded', color: 'bg-blue-100 text-blue-700' },
    published: { label: 'Published', color: 'bg-green-100 text-green-700' }
}

// ============================================================================
// SECTION 3: MAIN COMPONENT
// ============================================================================

export default function VideoManagementPage() {
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [selectedPriority, setSelectedPriority] = useState<string>('all')
    const [selectedStatus, setSelectedStatus] = useState<string>('all')
    const [sortField, setSortField] = useState<SortField>('priority')
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
    const [expandedVideo, setExpandedVideo] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    const stats = getVideoStats()

    // =========================================================================
    // SECTION 4: FILTERING & SORTING
    // =========================================================================

    let filteredVideos = [...VIDEO_LIBRARY]

    // Apply filters
    if (selectedCategory !== 'all') {
        filteredVideos = filteredVideos.filter(v => v.category === selectedCategory)
    }
    if (selectedPriority !== 'all') {
        filteredVideos = filteredVideos.filter(v => v.priority === selectedPriority)
    }
    if (selectedStatus !== 'all') {
        filteredVideos = filteredVideos.filter(v => v.status === selectedStatus)
    }
    if (searchTerm) {
        const term = searchTerm.toLowerCase()
        filteredVideos = filteredVideos.filter(v =>
            v.title.toLowerCase().includes(term) ||
            v.description.toLowerCase().includes(term) ||
            v.scriptNotes?.toLowerCase().includes(term)
        )
    }

    // Apply sorting
    filteredVideos.sort((a, b) => {
        let comparison = 0

        switch (sortField) {
            case 'priority':
                comparison = PRIORITY_CONFIG[a.priority].sortOrder - PRIORITY_CONFIG[b.priority].sortOrder
                break
            case 'category':
                comparison = a.category.localeCompare(b.category)
                break
            case 'title':
                comparison = a.title.localeCompare(b.title)
                break
            case 'status':
                comparison = a.status.localeCompare(b.status)
                break
        }

        return sortOrder === 'asc' ? comparison : -comparison
    })

    // =========================================================================
    // SECTION 5: RENDER
    // =========================================================================

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ================================================================ */}
            {/* SECTION 6: HEADER */}
            {/* ================================================================ */}
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Video Production Dashboard</h1>
                            <p className="text-slate-500 text-sm mt-1">
                                Manage CLARENCE tutorial videos for John
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                                Export Script List
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ================================================================ */}
            {/* SECTION 7: STATS CARDS */}
            {/* ================================================================ */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                        <div className="text-3xl font-bold text-slate-800">{stats.total}</div>
                        <div className="text-sm text-slate-500">Total Videos</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                        <div className="text-3xl font-bold text-amber-600">{stats.placeholder}</div>
                        <div className="text-sm text-slate-500">To Be Created</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                        <div className="text-3xl font-bold text-green-600">{stats.published}</div>
                        <div className="text-sm text-slate-500">Published</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                        <div className="text-3xl font-bold text-red-600">{stats.byPriority.high}</div>
                        <div className="text-sm text-slate-500">High Priority</div>
                    </div>
                </div>

                {/* ============================================================ */}
                {/* SECTION 8: CATEGORY BREAKDOWN */}
                {/* ============================================================ */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
                    <h3 className="font-semibold text-slate-800 mb-3">Videos by Category</h3>
                    <div className="flex flex-wrap gap-2">
                        {stats.byCategory.map(cat => (
                            <button
                                key={cat.category}
                                onClick={() => setSelectedCategory(cat.category)}
                                className={`px-3 py-2 rounded-lg text-sm transition-colors ${selectedCategory === cat.category
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                <span className="mr-1">{CATEGORY_ICONS[cat.category]}</span>
                                {cat.label}
                                <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                                    {cat.count}
                                </span>
                            </button>
                        ))}
                        {selectedCategory !== 'all' && (
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className="px-3 py-2 rounded-lg text-sm bg-slate-100 text-slate-500 hover:bg-slate-200"
                            >
                                Clear filter ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* ============================================================ */}
                {/* SECTION 9: FILTERS BAR */}
                {/* ============================================================ */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Search */}
                        <div className="flex-1 min-w-[200px]">
                            <input
                                type="text"
                                placeholder="Search videos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Priority Filter */}
                        <select
                            value={selectedPriority}
                            onChange={(e) => setSelectedPriority(e.target.value)}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                            <option value="all">All Priorities</option>
                            <option value="high">🔴 High Priority</option>
                            <option value="medium">🔵 Medium Priority</option>
                            <option value="low">⚪ Low Priority</option>
                        </select>

                        {/* Status Filter */}
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                            <option value="all">All Statuses</option>
                            <option value="placeholder">Not Started</option>
                            <option value="scripted">Script Ready</option>
                            <option value="recorded">Recorded</option>
                            <option value="published">Published</option>
                        </select>

                        {/* Sort */}
                        <select
                            value={`${sortField}-${sortOrder}`}
                            onChange={(e) => {
                                const [field, order] = e.target.value.split('-')
                                setSortField(field as SortField)
                                setSortOrder(order as SortOrder)
                            }}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                            <option value="priority-asc">Priority (High First)</option>
                            <option value="priority-desc">Priority (Low First)</option>
                            <option value="category-asc">Category (A-Z)</option>
                            <option value="title-asc">Title (A-Z)</option>
                            <option value="status-asc">Status</option>
                        </select>
                    </div>
                </div>

                {/* ============================================================ */}
                {/* SECTION 10: VIDEO LIST */}
                {/* ============================================================ */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                        <span className="font-medium text-slate-700">
                            {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {filteredVideos.map((video) => (
                            <div
                                key={video.id}
                                className="hover:bg-slate-50 transition-colors"
                            >
                                {/* Main Row */}
                                <div
                                    className="p-4 cursor-pointer"
                                    onClick={() => setExpandedVideo(expandedVideo === video.id ? null : video.id)}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 ${video.youtubeId ? 'bg-green-100' : 'bg-slate-100'
                                            }`}>
                                            {CATEGORY_ICONS[video.category]}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-semibold text-slate-800">
                                                    {video.title}
                                                </h4>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_CONFIG[video.priority].color}`}>
                                                    {PRIORITY_CONFIG[video.priority].label}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[video.status].color}`}>
                                                    {STATUS_CONFIG[video.status].label}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500 mt-1">
                                                {video.description}
                                            </p>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                                <span>{CATEGORY_LABELS[video.category]}</span>
                                                <span>•</span>
                                                <span>{video.duration}</span>
                                                <span>•</span>
                                                <span>{video.placement.length} placement{video.placement.length !== 1 ? 's' : ''}</span>
                                            </div>
                                        </div>

                                        {/* Expand Icon */}
                                        <div className={`text-slate-400 transition-transform ${expandedVideo === video.id ? 'rotate-180' : ''}`}>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedVideo === video.id && (
                                    <div className="px-4 pb-4 ml-16">
                                        <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                                            {/* Script Notes */}
                                            {video.scriptNotes && (
                                                <div>
                                                    <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                                        Script Notes for John
                                                    </h5>
                                                    <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
                                                        {video.scriptNotes}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Placements */}
                                            <div>
                                                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                                    Where This Appears
                                                </h5>
                                                <div className="flex flex-wrap gap-2">
                                                    {video.placement.map(place => (
                                                        <span
                                                            key={place}
                                                            className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600"
                                                        >
                                                            {place}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* YouTube Link */}
                                            <div>
                                                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                                    YouTube Video ID
                                                </h5>
                                                {video.youtubeId ? (
                                                    <a
                                                        href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:underline text-sm"
                                                    >
                                                        {video.youtubeId} ↗
                                                    </a>
                                                ) : (
                                                    <span className="text-sm text-slate-400 italic">
                                                        Not yet uploaded - add YouTube ID once published
                                                    </span>
                                                )}
                                            </div>

                                            {/* Video ID for reference */}
                                            <div>
                                                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                                    Video ID (for developers)
                                                </h5>
                                                <code className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-700">
                                                    {video.id}
                                                </code>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {filteredVideos.length === 0 && (
                        <div className="p-12 text-center text-slate-500">
                            No videos match your filters
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}