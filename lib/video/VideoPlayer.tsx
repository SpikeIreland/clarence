'use client'

// ============================================================================
// CLARENCE VIDEO PLAYER COMPONENT
// ============================================================================
// Reusable video component for embedding YouTube videos throughout CLARENCE.
// Supports placeholder state, inline embeds, and modal playback.
// ============================================================================

import { useState, useEffect } from 'react'
import { VideoMetadata, getVideoById, CATEGORY_ICONS } from './videoLibrary'

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface VideoPlayerProps {
    /** Video ID from the video library */
    videoId: string
    /** Display variant */
    variant?: 'inline' | 'card' | 'thumbnail' | 'help-button'
    /** Size preset */
    size?: 'small' | 'medium' | 'large' | 'full'
    /** Show title below video */
    showTitle?: boolean
    /** Show description below video */
    showDescription?: boolean
    /** Custom class names */
    className?: string
    /** Callback when video starts playing */
    onPlay?: () => void
    /** Callback when video ends */
    onEnd?: () => void
    /** Auto-play when component mounts (use sparingly) */
    autoPlay?: boolean
}

interface VideoModalProps {
    video: VideoMetadata
    isOpen: boolean
    onClose: () => void
}

interface VideoHelpButtonProps {
    videoId: string
    label?: string
    className?: string
}

interface VideoCardProps {
    video: VideoMetadata
    onClick?: () => void
    className?: string
}

// ============================================================================
// SECTION 2: SIZE CONFIGURATIONS
// ============================================================================

const SIZE_CONFIG = {
    small: {
        width: 280,
        height: 158,
        thumbnailClass: 'w-[280px] h-[158px]'
    },
    medium: {
        width: 480,
        height: 270,
        thumbnailClass: 'w-[480px] h-[270px]'
    },
    large: {
        width: 720,
        height: 405,
        thumbnailClass: 'w-[720px] h-[405px]'
    },
    full: {
        width: 1280,
        height: 720,
        thumbnailClass: 'w-full aspect-video'
    }
}

// ============================================================================
// SECTION 3: VIDEO MODAL COMPONENT
// ============================================================================

export function VideoModal({ video, isOpen, onClose }: VideoModalProps) {
    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            document.body.style.overflow = 'hidden'
        }
        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative z-10 w-full max-w-4xl mx-4">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 text-white/80 hover:text-white transition-colors flex items-center gap-2 text-sm"
                >
                    Close
                    <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                        ✕
                    </span>
                </button>

                {/* Video Container */}
                <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
                    {video.youtubeId ? (
                        <div className="aspect-video">
                            <iframe
                                src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
                                title={video.title}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    ) : (
                        <VideoPlaceholder video={video} size="full" inModal />
                    )}
                </div>

                {/* Video Info */}
                <div className="mt-4 text-white">
                    <h3 className="text-lg font-semibold">{video.title}</h3>
                    <p className="text-white/70 text-sm mt-1">{video.description}</p>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 4: VIDEO PLACEHOLDER (NO YOUTUBE ID YET)
// ============================================================================

interface VideoPlaceholderProps {
    video: VideoMetadata
    size: 'small' | 'medium' | 'large' | 'full'
    inModal?: boolean
    onClick?: () => void
}

function VideoPlaceholder({ video, size, inModal = false, onClick }: VideoPlaceholderProps) {
    const sizeConfig = SIZE_CONFIG[size]
    const categoryIcon = CATEGORY_ICONS[video.category]

    return (
        <div
            className={`relative bg-gradient-to-br from-slate-800 to-slate-900 ${sizeConfig.thumbnailClass} flex items-center justify-center ${onClick ? 'cursor-pointer group' : ''}`}
            onClick={onClick}
        >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }} />
            </div>

            {/* Content */}
            <div className="relative text-center px-4">
                {/* Icon */}
                <div className={`mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center ${size === 'small' ? 'w-12 h-12 text-2xl' : 'w-16 h-16 text-3xl'}`}>
                    {categoryIcon}
                </div>

                {/* Coming Soon Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium mb-2">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                    Coming Soon
                </div>

                {/* Title */}
                <h4 className={`text-white font-medium ${size === 'small' ? 'text-sm' : 'text-base'}`}>
                    {video.title}
                </h4>

                {/* Duration */}
                <p className="text-white/50 text-xs mt-1">
                    {video.duration}
                </p>

                {/* Play indicator on hover */}
                {onClick && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                )}
            </div>

            {/* CLARENCE Watermark */}
            <div className="absolute bottom-3 right-3 text-white/30 text-xs font-medium">
                CLARENCE
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 5: VIDEO THUMBNAIL
// ============================================================================

interface VideoThumbnailProps {
    video: VideoMetadata
    size: 'small' | 'medium' | 'large' | 'full'
    onClick?: () => void
}

function VideoThumbnail({ video, size, onClick }: VideoThumbnailProps) {
    const sizeConfig = SIZE_CONFIG[size]

    // If no YouTube ID, show placeholder
    if (!video.youtubeId) {
        return <VideoPlaceholder video={video} size={size} onClick={onClick} />
    }

    // YouTube thumbnail URL
    const thumbnailUrl = `https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`

    return (
        <div
            className={`relative ${sizeConfig.thumbnailClass} bg-slate-900 rounded-lg overflow-hidden cursor-pointer group`}
            onClick={onClick}
        >
            {/* Thumbnail Image */}
            <img
                src={thumbnailUrl}
                alt={video.title}
                className="w-full h-full object-cover"
            />

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />

            {/* Play Button */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-red-600 group-hover:bg-red-500 transition-colors flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </div>
            </div>

            {/* Duration Badge */}
            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-white text-xs rounded">
                {video.duration}
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 6: VIDEO CARD COMPONENT
// ============================================================================

export function VideoCard({ video, onClick, className = '' }: VideoCardProps) {
    const [showModal, setShowModal] = useState(false)
    const categoryIcon = CATEGORY_ICONS[video.category]

    const handleClick = () => {
        if (onClick) {
            onClick()
        } else {
            setShowModal(true)
        }
    }

    return (
        <>
            <div
                className={`bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-md transition-all cursor-pointer ${className}`}
                onClick={handleClick}
            >
                {/* Thumbnail */}
                <VideoThumbnail video={video} size="medium" />

                {/* Info */}
                <div className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">
                            {categoryIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-800 text-sm line-clamp-2">
                                {video.title}
                            </h4>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                {video.description}
                            </p>
                        </div>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {video.duration}
                        </span>
                        {!video.youtubeId && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full font-medium">
                                Coming Soon
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal */}
            <VideoModal video={video} isOpen={showModal} onClose={() => setShowModal(false)} />
        </>
    )
}

// ============================================================================
// SECTION 7: VIDEO HELP BUTTON (INLINE TRIGGER)
// ============================================================================

export function VideoHelpButton({ videoId, label, className = '' }: VideoHelpButtonProps) {
    const [showModal, setShowModal] = useState(false)
    const video = getVideoById(videoId)

    if (!video) {
        console.warn(`Video not found: ${videoId}`)
        return null
    }

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className={`inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors ${className}`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {label || 'Watch Video'}
            </button>

            <VideoModal video={video} isOpen={showModal} onClose={() => setShowModal(false)} />
        </>
    )
}

// ============================================================================
// SECTION 8: FLOATING HELP ICON
// ============================================================================

interface VideoHelpIconProps {
    videoId: string
    className?: string
}

export function VideoHelpIcon({ videoId, className = '' }: VideoHelpIconProps) {
    const [showModal, setShowModal] = useState(false)
    const video = getVideoById(videoId)

    if (!video) return null

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className={`w-5 h-5 rounded-full bg-slate-200 hover:bg-blue-100 text-slate-500 hover:text-blue-600 flex items-center justify-center transition-colors ${className}`}
                title={`Watch: ${video.title}`}
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>

            <VideoModal video={video} isOpen={showModal} onClose={() => setShowModal(false)} />
        </>
    )
}

// ============================================================================
// SECTION 9: MAIN VIDEO PLAYER COMPONENT
// ============================================================================

export default function VideoPlayer({
    videoId,
    variant = 'inline',
    size = 'medium',
    showTitle = false,
    showDescription = false,
    className = '',
    onPlay,
    onEnd,
    autoPlay = false
}: VideoPlayerProps) {
    const [showModal, setShowModal] = useState(false)
    const [isPlaying, setIsPlaying] = useState(autoPlay)
    const video = getVideoById(videoId)

    if (!video) {
        console.warn(`Video not found: ${videoId}`)
        return null
    }

    const sizeConfig = SIZE_CONFIG[size]

    // Help button variant
    if (variant === 'help-button') {
        return <VideoHelpButton videoId={videoId} className={className} />
    }

    // Card variant
    if (variant === 'card') {
        return <VideoCard video={video} className={className} />
    }

    // Thumbnail variant (click to open modal)
    if (variant === 'thumbnail') {
        return (
            <>
                <div className={className}>
                    <VideoThumbnail video={video} size={size} onClick={() => setShowModal(true)} />
                    {showTitle && (
                        <h4 className="font-medium text-slate-800 mt-2 text-sm">{video.title}</h4>
                    )}
                    {showDescription && (
                        <p className="text-xs text-slate-500 mt-1">{video.description}</p>
                    )}
                </div>
                <VideoModal video={video} isOpen={showModal} onClose={() => setShowModal(false)} />
            </>
        )
    }

    // Inline variant (embedded player)
    return (
        <div className={`${className}`}>
            {video.youtubeId ? (
                <div className={`${sizeConfig.thumbnailClass} rounded-lg overflow-hidden bg-black`}>
                    {isPlaying ? (
                        <iframe
                            src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
                            title={video.title}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            onLoad={() => onPlay?.()}
                        />
                    ) : (
                        <VideoThumbnail
                            video={video}
                            size={size}
                            onClick={() => {
                                setIsPlaying(true)
                                onPlay?.()
                            }}
                        />
                    )}
                </div>
            ) : (
                <VideoPlaceholder video={video} size={size} />
            )}

            {showTitle && (
                <h4 className="font-medium text-slate-800 mt-3">{video.title}</h4>
            )}
            {showDescription && (
                <p className="text-sm text-slate-500 mt-1">{video.description}</p>
            )}
        </div>
    )
}

// ============================================================================
// SECTION 10: VIDEO LIBRARY BROWSER (FOR ADMIN/DEBUG)
// ============================================================================

interface VideoLibraryBrowserProps {
    onSelectVideo?: (video: VideoMetadata) => void
    filterCategory?: string
    showPlaceholdersOnly?: boolean
}

export function VideoLibraryBrowser({
    onSelectVideo,
    filterCategory,
    showPlaceholdersOnly = false
}: VideoLibraryBrowserProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>(filterCategory || 'all')

    // Import the full library
    const { VIDEO_LIBRARY, CATEGORY_LABELS, getVideoStats } = require('./videoLibrary')

    const stats = getVideoStats()

    // Filter videos
    let filteredVideos = VIDEO_LIBRARY as VideoMetadata[]

    if (selectedCategory !== 'all') {
        filteredVideos = filteredVideos.filter((v: VideoMetadata) => v.category === selectedCategory)
    }

    if (showPlaceholdersOnly) {
        filteredVideos = filteredVideos.filter((v: VideoMetadata) => !v.youtubeId)
    }

    if (searchTerm) {
        const term = searchTerm.toLowerCase()
        filteredVideos = filteredVideos.filter((v: VideoMetadata) =>
            v.title.toLowerCase().includes(term) ||
            v.description.toLowerCase().includes(term)
        )
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-semibold text-slate-800">Video Library</h3>
                <p className="text-sm text-slate-500">
                    {stats.published} published • {stats.placeholder} placeholders • {stats.total} total
                </p>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-slate-200 flex gap-4">
                <input
                    type="text"
                    placeholder="Search videos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                    <option value="all">All Categories</option>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label as string}</option>
                    ))}
                </select>
            </div>

            {/* Video List */}
            <div className="max-h-[500px] overflow-auto">
                {filteredVideos.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        No videos found
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredVideos.map((video: VideoMetadata) => (
                            <div
                                key={video.id}
                                className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                                onClick={() => onSelectVideo?.(video)}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${video.youtubeId ? 'bg-green-100' : 'bg-amber-100'
                                        }`}>
                                        {CATEGORY_ICONS[video.category]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-slate-800 text-sm">{video.title}</h4>
                                            {!video.youtubeId && (
                                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-600 text-xs rounded">
                                                    Placeholder
                                                </span>
                                            )}
                                            <span className={`px-1.5 py-0.5 text-xs rounded ${video.priority === 'high' ? 'bg-red-100 text-red-600' :
                                                    video.priority === 'medium' ? 'bg-blue-100 text-blue-600' :
                                                        'bg-slate-100 text-slate-600'
                                                }`}>
                                                {video.priority}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">{video.description}</p>
                                        <p className="text-xs text-slate-400 mt-1">{video.duration}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}