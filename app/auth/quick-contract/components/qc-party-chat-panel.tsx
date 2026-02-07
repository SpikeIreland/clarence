'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

interface PartyMessage {
    messageId: string
    contractId: string
    senderUserId: string
    senderName: string
    senderRole: 'initiator' | 'respondent'
    messageText: string
    relatedClauseId?: string
    relatedClauseNumber?: string
    relatedClauseName?: string
    isSystemMessage: boolean
    isRead: boolean
    createdAt: string
}

interface QCPartyChatPanelProps {
    contractId: string
    otherPartyName: string
    otherPartyCompany?: string | null
    currentUserId: string
    currentUserName: string
    partyRole: 'initiator' | 'respondent'
    isOpen: boolean
    onClose: () => void
    onUnreadCountChange?: (count: number) => void
    // Optional: for injecting messages from clause queries
    externalMessages?: Array<{
        messageId: string
        senderRole: 'initiator' | 'respondent'
        senderName: string
        messageText: string
        relatedClauseNumber?: string
        relatedClauseName?: string
        isSystemMessage?: boolean
        createdAt: string
    }>
    onExternalMessagesConsumed?: () => void
}

interface ToastNotification {
    id: string
    senderName: string
    preview: string
    timestamp: Date
}

// ============================================================================
// SECTION 2: TOAST NOTIFICATION COMPONENT
// ============================================================================

interface ToastProps {
    notification: ToastNotification
    onDismiss: (id: string) => void
    onOpen: () => void
}

function ChatToast({ notification, onDismiss, onOpen }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(notification.id)
        }, 5000)

        return () => clearTimeout(timer)
    }, [notification.id, onDismiss])

    return (
        <div
            className="animate-slide-in-right bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-4 max-w-sm cursor-pointer hover:bg-slate-700 transition-colors"
            onClick={onOpen}
        >
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-sm">
                        {notification.senderName.charAt(0).toUpperCase()}
                    </span>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white text-sm truncate">
                            {notification.senderName}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onDismiss(notification.id)
                            }}
                            className="text-slate-400 hover:text-white transition"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className="text-slate-300 text-sm mt-1 line-clamp-2">
                        {notification.preview}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">
                        Click to open chat
                    </p>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 3: TOAST CONTAINER COMPONENT
// ============================================================================

interface ToastContainerProps {
    toasts: ToastNotification[]
    onDismiss: (id: string) => void
    onOpenChat: () => void
}

function ToastContainer({ toasts, onDismiss, onOpenChat }: ToastContainerProps) {
    if (toasts.length === 0) return null

    return (
        <div className="fixed top-20 right-4 z-50 space-y-2">
            {toasts.map(toast => (
                <ChatToast
                    key={toast.id}
                    notification={toast}
                    onDismiss={onDismiss}
                    onOpen={onOpenChat}
                />
            ))}
        </div>
    )
}

// ============================================================================
// SECTION 4: MESSAGE BUBBLE COMPONENT
// ============================================================================

interface MessageBubbleProps {
    message: PartyMessage
    isOwnMessage: boolean
}

function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
    const time = new Date(message.createdAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
    })

    return (
        <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`}>
            <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${message.isSystemMessage
                    ? 'bg-amber-900/40 border border-amber-700/50'
                    : isOwnMessage
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-white'
                    }`}
            >
                {/* Clause reference badge */}
                {message.relatedClauseNumber && (
                    <div className={`text-xs font-medium mb-1 ${message.isSystemMessage
                        ? 'text-amber-400'
                        : isOwnMessage
                            ? 'text-emerald-200'
                            : 'text-slate-400'
                        }`}>
                        Re: {message.relatedClauseNumber} - {message.relatedClauseName}
                    </div>
                )}

                <p className={`text-sm whitespace-pre-wrap ${message.isSystemMessage ? 'text-amber-200' : 'text-white'
                    }`}>
                    {message.messageText}
                </p>

                <div className={`flex items-center gap-2 mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    {!isOwnMessage && (
                        <span className="text-xs text-slate-400">{message.senderName}</span>
                    )}
                    <span className={`text-xs ${message.isSystemMessage
                        ? 'text-amber-500'
                        : isOwnMessage
                            ? 'text-emerald-300'
                            : 'text-slate-500'
                        }`}>
                        {time}
                    </span>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 5: TYPING INDICATOR COMPONENT
// ============================================================================

function TypingIndicator({ name }: { name: string }) {
    return (
        <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
            <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{name} is typing...</span>
        </div>
    )
}

// ============================================================================
// SECTION 6: MAIN QC PARTY CHAT PANEL COMPONENT
// ============================================================================

export function QCPartyChatPanel({
    contractId,
    otherPartyName,
    otherPartyCompany,
    currentUserId,
    currentUserName,
    partyRole,
    isOpen,
    onClose,
    onUnreadCountChange,
    externalMessages = [],
    onExternalMessagesConsumed
}: QCPartyChatPanelProps) {

    const supabase = createClient()

    // ========================================================================
    // SECTION 6A: STATE
    // ========================================================================

    const [messages, setMessages] = useState<PartyMessage[]>([])
    const [inputText, setInputText] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOtherTyping, setIsOtherTyping] = useState(false)
    const [toasts, setToasts] = useState<ToastNotification[]>([])
    const [lastMessageCount, setLastMessageCount] = useState(0)

    // ========================================================================
    // SECTION 6B: DETACHABLE/DRAGGABLE STATE
    // ========================================================================

    const [isDetached, setIsDetached] = useState(false)
    const [position, setPosition] = useState({ x: 100, y: 100 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

    // ========================================================================
    // SECTION 6C: REFS
    // ========================================================================

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    // ========================================================================
    // SECTION 6D: DRAG HANDLERS
    // ========================================================================

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!isDetached) return

        // Only start drag from the header area
        const target = e.target as HTMLElement
        if (!target.closest('[data-drag-handle]')) return

        e.preventDefault()
        setIsDragging(true)

        const rect = panelRef.current?.getBoundingClientRect()
        if (rect) {
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            })
        }
    }, [isDetached])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return

        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y

        // Keep window within viewport bounds
        const maxX = window.innerWidth - 360 // panel width
        const maxY = window.innerHeight - 500 // panel height

        setPosition({
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY))
        })
    }, [isDragging, dragOffset])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    // Add/remove global mouse listeners for dragging
    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = 'grabbing'
            document.body.style.userSelect = 'none'
        } else {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [isDragging, handleMouseMove, handleMouseUp])

    // Reset position when switching to detached mode
    const handleDetach = () => {
        if (!isDetached) {
            // Calculate a good starting position (center-left of screen)
            setPosition({
                x: Math.max(20, (window.innerWidth - 360) / 3),
                y: Math.max(80, (window.innerHeight - 500) / 4)
            })
        }
        setIsDetached(!isDetached)
    }

    // ========================================================================
    // SECTION 6E: API FUNCTIONS
    // ========================================================================

    const fetchMessages = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('qc_party_messages')
                .select('*')
                .eq('contract_id', contractId)
                .order('created_at', { ascending: true })

            if (error) {
                console.error('[QCPartyChat] Failed to fetch messages:', error)
                return
            }

            if (data) {
                const mapped: PartyMessage[] = data.map(m => ({
                    messageId: m.message_id,
                    contractId: m.contract_id,
                    senderUserId: m.sender_user_id,
                    senderName: m.sender_name,
                    senderRole: m.sender_role,
                    messageText: m.message_text,
                    relatedClauseId: m.related_clause_id,
                    relatedClauseNumber: m.related_clause_number,
                    relatedClauseName: m.related_clause_name,
                    isSystemMessage: m.is_system_message || false,
                    isRead: m.is_read || false,
                    createdAt: m.created_at
                }))

                // Check for new messages (for toast notifications)
                if (mapped.length > lastMessageCount && lastMessageCount > 0) {
                    const newMessages = mapped.slice(lastMessageCount)
                    newMessages.forEach(msg => {
                        if (msg.senderUserId !== currentUserId && !isOpen) {
                            addToast(msg)
                        }
                    })
                }
                setLastMessageCount(mapped.length)

                setMessages(mapped)

                // Calculate unread count
                const unread = mapped.filter(
                    m => !m.isRead && m.senderUserId !== currentUserId
                ).length
                setUnreadCount(unread)
                onUnreadCountChange?.(unread)
            }
        } catch (err) {
            console.error('[QCPartyChat] Fetch error:', err)
        }
    }, [contractId, currentUserId, onUnreadCountChange, isOpen, lastMessageCount, supabase])

    const sendMessage = async () => {
        if (!inputText.trim() || isSending) return

        setIsSending(true)
        const messageText = inputText.trim()
        setInputText('')

        try {
            const { error } = await supabase
                .from('qc_party_messages')
                .insert({
                    contract_id: contractId,
                    sender_user_id: currentUserId,
                    sender_name: currentUserName,
                    sender_role: partyRole,
                    message_text: messageText,
                    is_system_message: false,
                    is_read: false
                })

            if (error) {
                console.error('[QCPartyChat] Failed to send message:', error)
                setInputText(messageText) // Restore on error
                return
            }

            // Refetch messages
            await fetchMessages()

        } catch (err) {
            console.error('[QCPartyChat] Send error:', err)
            setInputText(messageText)
        } finally {
            setIsSending(false)
        }
    }

    const markAsRead = useCallback(async () => {
        try {
            await supabase
                .from('qc_party_messages')
                .update({ is_read: true })
                .eq('contract_id', contractId)
                .neq('sender_user_id', currentUserId)
                .eq('is_read', false)

            setUnreadCount(0)
            onUnreadCountChange?.(0)
        } catch (err) {
            console.error('[QCPartyChat] Mark as read error:', err)
        }
    }, [contractId, currentUserId, onUnreadCountChange, supabase])

    // ========================================================================
    // SECTION 6F: TOAST HELPERS
    // ========================================================================

    const addToast = (message: PartyMessage) => {
        const toast: ToastNotification = {
            id: `toast-${message.messageId}`,
            senderName: message.senderName,
            preview: message.messageText.length > 100
                ? message.messageText.substring(0, 100) + '...'
                : message.messageText,
            timestamp: new Date(message.createdAt)
        }
        setToasts(prev => [...prev, toast])
    }

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    // ========================================================================
    // SECTION 6G: EFFECTS
    // ========================================================================

    // Initial load
    useEffect(() => {
        fetchMessages()
    }, []) // Only once on mount

    // Full load when chat opens
    useEffect(() => {
        if (isOpen) {
            setIsLoading(true)
            fetchMessages().finally(() => setIsLoading(false))
        }
    }, [isOpen])

    // Supabase Realtime subscription for live updates
    useEffect(() => {
        const channel = supabase
            .channel(`qc-party-chat-${contractId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'qc_party_messages',
                    filter: `contract_id=eq.${contractId}`
                },
                (payload) => {
                    console.log('[QCPartyChat] New message received:', payload)
                    const newMsg = payload.new as Record<string, unknown>

                    const mappedMsg: PartyMessage = {
                        messageId: newMsg.message_id as string,
                        contractId: newMsg.contract_id as string,
                        senderUserId: newMsg.sender_user_id as string,
                        senderName: newMsg.sender_name as string,
                        senderRole: newMsg.sender_role as 'initiator' | 'respondent',
                        messageText: newMsg.message_text as string,
                        relatedClauseId: newMsg.related_clause_id as string | undefined,
                        relatedClauseNumber: newMsg.related_clause_number as string | undefined,
                        relatedClauseName: newMsg.related_clause_name as string | undefined,
                        isSystemMessage: (newMsg.is_system_message as boolean) || false,
                        isRead: (newMsg.is_read as boolean) || false,
                        createdAt: newMsg.created_at as string
                    }

                    // Only add if not from current user (avoid duplicates)
                    if (mappedMsg.senderUserId !== currentUserId) {
                        setMessages(prev => {
                            // Check for duplicates
                            if (prev.some(m => m.messageId === mappedMsg.messageId)) {
                                return prev
                            }
                            return [...prev, mappedMsg]
                        })

                        // Show toast if panel is closed
                        if (!isOpen) {
                            addToast(mappedMsg)
                            setUnreadCount(prev => {
                                const newCount = prev + 1
                                onUnreadCountChange?.(newCount)
                                return newCount
                            })
                        }
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [contractId, currentUserId, isOpen, onUnreadCountChange, supabase])

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (isOpen && messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, isOpen])

    // Mark as read when opening chat
    useEffect(() => {
        if (isOpen && unreadCount > 0) {
            markAsRead()
        }
    }, [isOpen, unreadCount, markAsRead])

    // Focus input when opening
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 300)
        }
    }, [isOpen])

    // Consume external messages (from clause queries)
    useEffect(() => {
        if (externalMessages && externalMessages.length > 0) {
            const newMessages: PartyMessage[] = externalMessages.map(msg => ({
                messageId: msg.messageId,
                contractId: contractId,
                senderUserId: currentUserId,
                senderName: msg.senderName,
                senderRole: msg.senderRole,
                messageText: msg.messageText,
                relatedClauseNumber: msg.relatedClauseNumber,
                relatedClauseName: msg.relatedClauseName,
                isSystemMessage: msg.isSystemMessage || false,
                isRead: isOpen,
                createdAt: msg.createdAt
            }))

            setMessages(prev => [...prev, ...newMessages])

            // Update unread count if panel is closed
            if (!isOpen) {
                const newUnread = unreadCount + newMessages.length
                setUnreadCount(newUnread)
                onUnreadCountChange?.(newUnread)
            }

            onExternalMessagesConsumed?.()
        }
    }, [externalMessages])

    // ========================================================================
    // SECTION 6H: DATE FORMATTING
    // ========================================================================

    const formatDateDivider = (dateString: string) => {
        const date = new Date(dateString)
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        if (date.toDateString() === today.toDateString()) {
            return 'Today'
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday'
        } else {
            return date.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'short'
            })
        }
    }

    // ========================================================================
    // SECTION 6I: STYLES
    // ========================================================================

    // Detached (floating) mode styles
    const detachedStyles = isDetached ? {
        position: 'fixed' as const,
        top: position.y,
        left: position.x,
        right: 'auto',
        width: '360px',
        height: '500px',
        borderRadius: '12px',
        transform: 'none',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
        boxShadow: isDragging
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            : '0 20px 40px -12px rgba(0, 0, 0, 0.4)'
    } : {}

    // Docked (slide-out) mode styles
    const dockedStyles = !isDetached ? {
        position: 'fixed' as const,
        top: 0,
        right: 0,
        height: '100%',
        width: '400px',
        maxWidth: '90vw',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease-out'
    } : {}

    // ========================================================================
    // SECTION 6J: RENDER
    // ========================================================================

    return (
        <>
            {/* Toast Notifications */}
            <ToastContainer
                toasts={toasts}
                onDismiss={dismissToast}
                onOpenChat={() => {
                    if (isDetached) {
                        // Already detached, just make sure it's visible
                    } else {
                        onClose() // This will toggle - parent should handle opening
                    }
                }}
            />

            {/* Backdrop (docked mode only) */}
            {!isDetached && isOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Chat Panel - Docked or Detached */}
            <div
                ref={panelRef}
                className={`
                    bg-slate-900 z-50 flex flex-col overflow-hidden
                    ${isDetached ? 'rounded-xl border border-slate-600' : 'shadow-[-8px_0_30px_rgba(0,0,0,0.3)]'}
                    ${!isOpen && !isDetached ? 'pointer-events-none' : ''}
                `}
                style={{
                    ...dockedStyles,
                    ...detachedStyles,
                    display: isOpen || isDetached ? 'flex' : undefined,
                    visibility: isOpen ? 'visible' : (isDetached ? 'visible' : 'hidden')
                }}
                onMouseDown={handleMouseDown}
            >
                {/* ============================================================ */}
                {/* PANEL HEADER - Drag Handle when detached */}
                {/* ============================================================ */}
                <div
                    className={`
                        px-4 py-3 border-b border-slate-700 flex-shrink-0 bg-slate-900
                        ${isDetached ? 'cursor-grab active:cursor-grabbing rounded-t-xl' : ''}
                    `}
                    data-drag-handle
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {/* Drag indicator when detached */}
                            {isDetached && (
                                <div className="flex flex-col gap-0.5 mr-1" data-drag-handle>
                                    <div className="w-4 h-0.5 bg-slate-600 rounded" />
                                    <div className="w-4 h-0.5 bg-slate-600 rounded" />
                                    <div className="w-4 h-0.5 bg-slate-600 rounded" />
                                </div>
                            )}

                            {/* Avatar */}
                            <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold text-sm">
                                    {otherPartyName.charAt(0).toUpperCase()}
                                </span>
                            </div>

                            {/* Name & Company */}
                            <div>
                                <h3 className="font-semibold text-white text-sm">{otherPartyName}</h3>
                                <p className="text-xs text-slate-400">
                                    {otherPartyCompany || 'Party Chat'}
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                            {/* Detach/Dock Button */}
                            <button
                                onClick={handleDetach}
                                className="p-2 hover:bg-slate-700 rounded-lg transition group"
                                title={isDetached ? 'Dock to side' : 'Detach window'}
                            >
                                {isDetached ? (
                                    // Dock icon (arrow pointing right to edge)
                                    <svg className="w-5 h-5 text-slate-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                    </svg>
                                ) : (
                                    // Detach icon (window with arrow)
                                    <svg className="w-5 h-5 text-slate-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                )}
                            </button>

                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-700 rounded-lg transition"
                            >
                                <svg className="w-5 h-5 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ============================================================ */}
                {/* MESSAGES CONTAINER */}
                {/* ============================================================ */}
                <div
                    className="flex-1 overflow-y-auto p-4 chat-scrollbar"
                    style={{
                        height: isDetached ? 'calc(100% - 130px)' : 'calc(100vh - 160px)'
                    }}
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-6">
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <p className="text-slate-400 text-sm font-medium mb-1">No messages yet</p>
                            <p className="text-slate-500 text-xs">
                                Send a message to start discussing this contract.
                                Queries on clauses will also appear here.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Date Divider for first message */}
                            {messages.length > 0 && (
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex-1 h-px bg-slate-700" />
                                    <span className="text-xs text-slate-500">
                                        {formatDateDivider(messages[0].createdAt)}
                                    </span>
                                    <div className="flex-1 h-px bg-slate-700" />
                                </div>
                            )}

                            {/* Messages */}
                            {messages.map((message, index) => {
                                // Check if we need a date divider before this message
                                const showDateDivider = index > 0 &&
                                    new Date(message.createdAt).toDateString() !==
                                    new Date(messages[index - 1].createdAt).toDateString()

                                return (
                                    <div key={message.messageId}>
                                        {showDateDivider && (
                                            <div className="flex items-center gap-3 my-4">
                                                <div className="flex-1 h-px bg-slate-700" />
                                                <span className="text-xs text-slate-500">
                                                    {formatDateDivider(message.createdAt)}
                                                </span>
                                                <div className="flex-1 h-px bg-slate-700" />
                                            </div>
                                        )}
                                        <MessageBubble
                                            message={message}
                                            isOwnMessage={message.senderUserId === currentUserId}
                                        />
                                    </div>
                                )
                            })}

                            {/* Typing Indicator */}
                            {isOtherTyping && (
                                <TypingIndicator name={otherPartyName} />
                            )}

                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* ============================================================ */}
                {/* INPUT AREA */}
                {/* ============================================================ */}
                <div className={`
                    border-t border-slate-700 p-4 flex-shrink-0 bg-slate-900
                    ${isDetached ? 'rounded-b-xl' : ''}
                `}>
                    <div className="flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                            placeholder={`Message ${otherPartyName}...`}
                            className="flex-1 bg-slate-700 text-white placeholder-slate-400 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            disabled={isSending}
                        />

                        <button
                            onClick={sendMessage}
                            disabled={!inputText.trim() || isSending}
                            className={`
                                p-2.5 rounded-lg transition-all
                                ${inputText.trim() && !isSending
                                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }
                            `}
                        >
                            {isSending ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}

export default QCPartyChatPanel