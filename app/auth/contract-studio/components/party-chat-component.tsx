'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

interface PartyMessage {
    messageId: string
    sessionId: string
    providerId?: string
    senderType: 'customer' | 'provider'
    senderUserId?: string
    senderName: string
    messageText: string
    relatedClauseId?: string
    isRead: boolean
    readAt?: string
    createdAt: string
    isAI?: boolean  // NEW: Flag for AI-generated messages in training mode
}

interface PartyChatPanelProps {
    sessionId: string
    providerId: string
    providerName: string
    currentUserType: 'customer' | 'provider'
    currentUserName: string
    currentUserId?: string
    isProviderOnline?: boolean
    isOpen: boolean
    onClose: () => void
    onUnreadCountChange?: (count: number) => void
    // NEW: Training Mode AI Props
    isAIOpponent?: boolean
    aiPersonality?: 'cooperative' | 'balanced' | 'aggressive'
    avatarName?: string
    avatarInitials?: string
    avatarCompany?: string
}

interface ToastNotification {
    id: string
    senderName: string
    preview: string
    timestamp: Date
}

// API Response types
interface ApiMessageResponse {
    message_id: string
    session_id: string
    provider_id?: string
    sender_type: string
    sender_user_id?: string
    sender_name: string
    message_text: string
    related_clause_id?: string
    is_read: boolean
    read_at?: string
    created_at: string
}

// ============================================================================
// SECTION 2: API CONFIGURATION
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// ============================================================================
// SECTION 2A: AI GREETING MESSAGES (NEW)
// ============================================================================

function getAIGreeting(personality: string, avatarName: string): string {
    const greetings: Record<string, string> = {
        cooperative: `Hello! I'm ${avatarName}. I'm looking forward to working together to find a fair agreement. Feel free to ask me any questions about my positions - I believe in open communication.`,
        balanced: `Good to meet you. I'm ${avatarName}, and I'll be representing the provider in this negotiation. Let's see if we can reach terms that work for both sides.`,
        aggressive: `Let's get down to business. I'm ${avatarName}. I should warn you - my client has firm requirements on several clauses, so I expect you'll need to be flexible if we're going to close this deal.`
    }
    return greetings[personality] || greetings.balanced
}

// ============================================================================
// SECTION 3: TOAST NOTIFICATION COMPONENT
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
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
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
// SECTION 4: TOAST CONTAINER COMPONENT
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
// SECTION 5: MESSAGE BUBBLE COMPONENT (UPDATED for AI styling)
// ============================================================================

interface MessageBubbleProps {
    message: PartyMessage
    isOwnMessage: boolean
    isAIMode?: boolean
}

function MessageBubble({ message, isOwnMessage, isAIMode = false }: MessageBubbleProps) {
    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    // Determine bubble styling based on sender and AI mode
    const getBubbleStyle = () => {
        if (isOwnMessage) {
            return 'bg-emerald-500 text-white rounded-br-md'
        }
        if (isAIMode && message.isAI) {
            return 'bg-amber-900/50 text-slate-100 rounded-bl-md border border-amber-700/50'
        }
        return 'bg-slate-700 text-slate-100 rounded-bl-md'
    }

    return (
        <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${getBubbleStyle()}`}>
                {!isOwnMessage && (
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold ${isAIMode && message.isAI ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {message.senderName}
                        </span>
                        {isAIMode && message.isAI && (
                            <span className="text-xs text-amber-500/70">• AI</span>
                        )}
                    </div>
                )}

                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.messageText}
                </p>

                <div className={`
                    flex items-center gap-1 mt-1 text-xs
                    ${isOwnMessage ? 'text-emerald-100 justify-end' : 'text-slate-400'}
                `}>
                    <span>{formatTime(message.createdAt)}</span>
                    {isOwnMessage && !isAIMode && (
                        <span>
                            {message.isRead ? (
                                <svg className="w-4 h-4 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4 text-emerald-200/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 6: TYPING INDICATOR COMPONENT
// ============================================================================

function TypingIndicator({ name, isAI = false }: { name: string; isAI?: boolean }) {
    return (
        <div className={`flex items-center gap-2 text-sm mb-3 ${isAI ? 'text-amber-400' : 'text-slate-400'}`}>
            <div className="flex gap-1">
                <span className={`w-2 h-2 rounded-full animate-bounce ${isAI ? 'bg-amber-400' : 'bg-slate-400'}`} style={{ animationDelay: '0ms' }} />
                <span className={`w-2 h-2 rounded-full animate-bounce ${isAI ? 'bg-amber-400' : 'bg-slate-400'}`} style={{ animationDelay: '150ms' }} />
                <span className={`w-2 h-2 rounded-full animate-bounce ${isAI ? 'bg-amber-400' : 'bg-slate-400'}`} style={{ animationDelay: '300ms' }} />
            </div>
            <span>{name} is typing...</span>
        </div>
    )
}

// ============================================================================
// SECTION 7: HELPER FUNCTION - Transform API Response
// ============================================================================

function transformApiMessage(apiMsg: ApiMessageResponse): PartyMessage {
    return {
        messageId: apiMsg.message_id,
        sessionId: apiMsg.session_id,
        providerId: apiMsg.provider_id,
        senderType: apiMsg.sender_type as 'customer' | 'provider',
        senderUserId: apiMsg.sender_user_id,
        senderName: apiMsg.sender_name,
        messageText: apiMsg.message_text,
        relatedClauseId: apiMsg.related_clause_id,
        isRead: apiMsg.is_read,
        readAt: apiMsg.read_at,
        createdAt: apiMsg.created_at,
        isAI: false
    }
}

// ============================================================================
// SECTION 8: MAIN PARTY CHAT PANEL COMPONENT
// ============================================================================

export function PartyChatPanel({
    sessionId,
    providerId,
    providerName,
    currentUserType,
    currentUserName,
    currentUserId,
    isProviderOnline = false,
    isOpen,
    onClose,
    onUnreadCountChange,
    // NEW: Training Mode AI Props with defaults
    isAIOpponent = false,
    aiPersonality = 'balanced',
    avatarName,
    avatarInitials,
    avatarCompany
}: PartyChatPanelProps) {
    // Debug: Log props on render
    console.log('[PartyChat] Component props:', {
        sessionId,
        providerId,
        providerName,
        currentUserType,
        currentUserName,
        isOpen,
        isAIOpponent,
        aiPersonality
    })

    // State
    const [messages, setMessages] = useState<PartyMessage[]>([])
    const [inputText, setInputText] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOtherTyping, setIsOtherTyping] = useState(false)
    const [toasts, setToasts] = useState<ToastNotification[]>([])
    const [lastMessageCount, setLastMessageCount] = useState(0)

    // NEW: AI Mode specific state
    const [hasShownAIGreeting, setHasShownAIGreeting] = useState(false)

    // ========================================================================
    // SECTION 8A: DETACHABLE/DRAGGABLE STATE
    // ========================================================================
    const [isDetached, setIsDetached] = useState(false)
    const [position, setPosition] = useState({ x: 100, y: 100 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    // ========================================================================
    // SECTION 8A-2: COMPUTED VALUES FOR AI MODE
    // ========================================================================

    // Use avatar props if in AI mode, otherwise use provider info
    const displayName = isAIOpponent ? (avatarName || 'AI Opponent') : providerName
    const displayInitials = isAIOpponent
        ? (avatarInitials || 'AI')
        : providerName?.charAt(0).toUpperCase() || 'P'
    const displayCompany = isAIOpponent ? avatarCompany : undefined
    const effectiveOnlineStatus = isAIOpponent ? true : isProviderOnline // AI is always "online"

    // ========================================================================
    // SECTION 8A-3: DRAG HANDLERS
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

    // ============================================================================
    // SECTION 8B: API FUNCTIONS (REAL MODE)
    // ============================================================================

    const fetchMessages = useCallback(async () => {
        // Skip fetching in AI mode - messages are local only
        if (isAIOpponent) return

        try {
            console.log('[PartyChat] Fetching messages for session:', sessionId)

            const response = await fetch(
                `${API_BASE}/party-chat-messages?session_id=${sessionId}&limit=100`
            )

            if (!response.ok) {
                console.error('[PartyChat] Response not OK:', response.status)
                throw new Error('Failed to fetch messages')
            }

            const data = await response.json()
            console.log('[PartyChat] Raw API response:', data)

            // Handle response - could be { success, messages } or direct array
            const apiMessages: ApiMessageResponse[] = Array.isArray(data) ? data : (data.messages || [])
            console.log('[PartyChat] Parsed messages count:', apiMessages.length)

            // Transform API response to our interface
            const transformedMessages = apiMessages.map(transformApiMessage)
            console.log('[PartyChat] Transformed messages:', transformedMessages)

            // Check for new messages (for toast notifications)
            if (transformedMessages.length > lastMessageCount && lastMessageCount > 0) {
                const newMessages = transformedMessages.slice(lastMessageCount)
                newMessages.forEach(msg => {
                    if (msg.senderType !== currentUserType && !isOpen) {
                        addToast(msg)
                    }
                })
            }
            setLastMessageCount(transformedMessages.length)

            setMessages(transformedMessages)

            // Calculate unread count (messages from other party that are unread)
            const unread = transformedMessages.filter(
                m => !m.isRead && m.senderType !== currentUserType
            ).length
            console.log('[PartyChat] Unread count:', unread)
            setUnreadCount(unread)
            onUnreadCountChange?.(unread)

        } catch (error) {
            console.error('[PartyChat] Failed to fetch messages:', error)
        }
    }, [sessionId, currentUserType, onUnreadCountChange, isOpen, lastMessageCount, isAIOpponent])

    const sendMessage = async () => {
        if (!inputText.trim() || isSending) return

        // Route to appropriate handler
        if (isAIOpponent) {
            await sendAIMessage()
        } else {
            await sendRealMessage()
        }
    }

    // ============================================================================
    // SECTION 8B-2: SEND MESSAGE (REAL MODE)
    // ============================================================================

    const sendRealMessage = async () => {
        setIsSending(true)
        const messageText = inputText.trim()
        setInputText('') // Clear input immediately for better UX

        console.log('[PartyChat] Sending message:', {
            session_id: sessionId,
            sender_type: currentUserType,
            sender_name: currentUserName,
            message_text: messageText
        })

        try {
            const response = await fetch(`${API_BASE}/party-chat-send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    provider_id: providerId || null,
                    sender_type: currentUserType,
                    sender_user_id: currentUserId || null,
                    sender_name: currentUserName,
                    message_text: messageText
                })
            })

            if (!response.ok) {
                console.error('[PartyChat] Send response not OK:', response.status)
                throw new Error('Failed to send message')
            }

            const data = await response.json()
            console.log('[PartyChat] Send response:', data)

            // Refetch all messages to ensure consistency
            await fetchMessages()

        } catch (error) {
            console.error('[PartyChat] Failed to send message:', error)
            // Restore the input text if send failed
            setInputText(messageText)
        } finally {
            setIsSending(false)
        }
    }

    // ============================================================================
    // SECTION 8B-3: SEND MESSAGE (AI MODE) - NEW
    // ============================================================================

    const sendAIMessage = async () => {
        const messageText = inputText.trim()
        setInputText('')

        // Add user message immediately
        const userMessage: PartyMessage = {
            messageId: `user-${Date.now()}`,
            sessionId: sessionId,
            senderType: currentUserType,
            senderUserId: currentUserId,
            senderName: currentUserName,
            messageText: messageText,
            isRead: true,
            createdAt: new Date().toISOString(),
            isAI: false
        }
        setMessages(prev => [...prev, userMessage])

        // Show typing indicator
        setIsOtherTyping(true)
        setIsSending(true)

        try {
            // Call the training party chat endpoint
            const response = await fetch(`${API_BASE}/training-party-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionId,
                    userMessage: messageText,
                    aiPersonality: aiPersonality,
                    avatarName: displayName,
                    chatHistory: messages.slice(-10).map(m => ({
                        sender: m.senderType,
                        message: m.messageText
                    }))
                })
            })

            // Simulate natural typing delay (1.5-3 seconds)
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500))

            let aiResponseText: string

            if (response.ok) {
                const result = await response.json()
                aiResponseText = result.aiResponse || getFallbackResponse(aiPersonality)
            } else {
                // Use fallback if API fails
                aiResponseText = getFallbackResponse(aiPersonality)
            }

            // Add AI response
            const aiMessage: PartyMessage = {
                messageId: `ai-${Date.now()}`,
                sessionId: sessionId,
                senderType: 'provider',
                senderUserId: undefined,
                senderName: displayName,
                messageText: aiResponseText,
                isRead: true,
                createdAt: new Date().toISOString(),
                isAI: true
            }
            setMessages(prev => [...prev, aiMessage])

        } catch (error) {
            console.error('[PartyChat] AI response error:', error)

            // Graceful fallback
            const fallbackMessage: PartyMessage = {
                messageId: `ai-fallback-${Date.now()}`,
                sessionId: sessionId,
                senderType: 'provider',
                senderUserId: undefined,
                senderName: displayName,
                messageText: getFallbackResponse(aiPersonality),
                isRead: true,
                createdAt: new Date().toISOString(),
                isAI: true
            }
            setMessages(prev => [...prev, fallbackMessage])
        } finally {
            setIsOtherTyping(false)
            setIsSending(false)
        }
    }

    // Fallback responses when API is unavailable
    function getFallbackResponse(personality: string): string {
        const fallbacks: Record<string, string[]> = {
            cooperative: [
                "I appreciate your input. Let's continue our discussion through the clause positions.",
                "That's a fair point. I'm open to finding middle ground on this.",
                "I understand your perspective. Let me consider how we can accommodate that."
            ],
            balanced: [
                "I understand. Let me think about that and we can discuss it further during the clause negotiation.",
                "That's worth considering. We should address that when we get to the specific clause.",
                "Noted. I'll keep that in mind as we work through the positions."
            ],
            aggressive: [
                "We can discuss that, but my client's requirements on this are quite firm.",
                "I hear you, though I should mention we have limited flexibility there.",
                "Let's see where we land on the clause positions before making any commitments."
            ]
        }
        const options = fallbacks[personality] || fallbacks.balanced
        return options[Math.floor(Math.random() * options.length)]
    }

    // ============================================================================
    // SECTION 8B-4: MARK AS READ (REAL MODE ONLY)
    // ============================================================================

    const markAsRead = useCallback(async () => {
        if (unreadCount === 0 || isAIOpponent) return

        try {
            const response = await fetch(`${API_BASE}/party-chat-mark-read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    reader_type: currentUserType
                })
            })

            if (!response.ok) {
                throw new Error('Failed to mark messages as read')
            }

            // Update local state
            setMessages(prev => prev.map(m => ({
                ...m,
                isRead: m.senderType !== currentUserType ? true : m.isRead,
                readAt: m.senderType !== currentUserType && !m.isRead
                    ? new Date().toISOString()
                    : m.readAt
            })))
            setUnreadCount(0)
            onUnreadCountChange?.(0)

        } catch (error) {
            console.error('Failed to mark messages as read:', error)
        }
    }, [sessionId, currentUserType, onUnreadCountChange, unreadCount, isAIOpponent])

    // ============================================================================
    // SECTION 8C: TOAST MANAGEMENT
    // ============================================================================

    const addToast = (message: PartyMessage) => {
        const toast: ToastNotification = {
            id: message.messageId,
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

    // ============================================================================
    // SECTION 8D: EFFECTS
    // ============================================================================

    // AI Greeting on first open (AI MODE ONLY) - NEW
    useEffect(() => {
        if (isOpen && isAIOpponent && !hasShownAIGreeting && messages.length === 0) {
            const greetingMessage: PartyMessage = {
                messageId: `ai-greeting-${Date.now()}`,
                sessionId: sessionId,
                senderType: 'provider',
                senderUserId: undefined,
                senderName: displayName,
                messageText: getAIGreeting(aiPersonality, displayName),
                isRead: true,
                createdAt: new Date().toISOString(),
                isAI: true
            }
            setMessages([greetingMessage])
            setHasShownAIGreeting(true)
        }
    }, [isOpen, isAIOpponent, hasShownAIGreeting, messages.length, sessionId, displayName, aiPersonality])

    // Initial load - fetch messages once on mount (REAL MODE ONLY)
    useEffect(() => {
        if (!isAIOpponent) {
            fetchMessages()
        }
    }, [isAIOpponent]) // Only run once on mount

    // Full load when chat opens (REAL MODE ONLY)
    useEffect(() => {
        if (isOpen && !isAIOpponent) {
            setIsLoading(true)
            fetchMessages().finally(() => setIsLoading(false))
        }
    }, [isOpen, isAIOpponent])

    // Polling for new messages (REAL MODE ONLY)
    useEffect(() => {
        // Skip polling in AI mode
        if (isAIOpponent) return

        // Clear any existing interval
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
        }

        const pollInterval = isOpen ? 10000 : 30000 // 10s when open, 30s when closed
        pollingIntervalRef.current = setInterval(fetchMessages, pollInterval)

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
            }
        }
    }, [isOpen, fetchMessages, isAIOpponent])

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (isOpen && messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, isOpen])

    // Mark as read when opening chat (REAL MODE ONLY)
    useEffect(() => {
        if (isOpen && unreadCount > 0 && !isAIOpponent) {
            markAsRead()
        }
    }, [isOpen, unreadCount, markAsRead, isAIOpponent])

    // Focus input when opening
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 300)
        }
    }, [isOpen])

    // ============================================================================
    // SECTION 8E: RENDER
    // ============================================================================

    const otherPartyName = currentUserType === 'customer' ? displayName : 'Customer'

    // Group messages by date for date dividers
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

    // Personality badge colors for AI mode
    const personalityColors: Record<string, string> = {
        cooperative: 'bg-emerald-500/20 text-emerald-400',
        balanced: 'bg-amber-500/20 text-amber-400',
        aggressive: 'bg-rose-500/20 text-rose-400'
    }

    // ========================================================================
    // DETACHED (FLOATING) MODE STYLES
    // ========================================================================
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

    // ========================================================================
    // DOCKED (SLIDE-OUT) MODE STYLES  
    // ========================================================================
    const dockedStyles = !isDetached ? {
        position: 'fixed' as const,
        top: 0,
        right: 0,
        height: '100%',
        width: '384px', // w-96
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease-out'
    } : {}

    return (
        <>
            {/* Toast Notifications (REAL MODE ONLY) */}
            {!isAIOpponent && (
                <ToastContainer
                    toasts={toasts}
                    onDismiss={dismissToast}
                    onOpenChat={() => { }}
                />
            )}

            {/* Chat Panel - Docked or Detached */}
            <div
                ref={panelRef}
                className={`
                    bg-slate-800 z-50 flex flex-col overflow-hidden
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
                {/* Panel Header - Drag Handle when detached */}
                <div
                    className={`
                        px-4 py-3 border-b border-slate-700 flex-shrink-0
                        ${isDetached ? 'cursor-grab active:cursor-grabbing rounded-t-xl' : ''}
                        ${isAIOpponent ? 'bg-amber-900/30' : 'bg-slate-900'}
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

                            {/* Avatar - different styling for AI mode */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isAIOpponent
                                    ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                                    : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                                }`}>
                                <span className="text-white font-semibold">
                                    {displayInitials}
                                </span>
                            </div>

                            {/* Name & Status */}
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-white">{otherPartyName}</h3>
                                    {isAIOpponent && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${personalityColors[aiPersonality]}`}>
                                            {aiPersonality}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full ${effectiveOnlineStatus ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                                    <span className={`text-xs ${effectiveOnlineStatus ? 'text-emerald-400' : 'text-slate-400'}`}>
                                        {isAIOpponent ? 'AI Training' : (effectiveOnlineStatus ? 'Online' : 'Offline')}
                                    </span>
                                    {isAIOpponent && displayCompany && (
                                        <span className="text-xs text-slate-500">• {displayCompany}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                            {/* AI Badge */}
                            {isAIOpponent && (
                                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full font-medium flex items-center gap-1 mr-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                    </svg>
                                    AI
                                </span>
                            )}

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
                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* AI Mode Info Banner */}
                    {isAIOpponent && (
                        <div className="mt-3 p-2 bg-amber-900/30 rounded-lg border border-amber-700/30">
                            <p className="text-xs text-amber-200/80">
                                <strong>Training Mode:</strong> Chat with {displayName} to discuss positions informally.
                                Binding moves happen through clause adjustments.
                            </p>
                        </div>
                    )}
                </div>

                {/* Messages Container */}
                <div
                    className="flex-1 overflow-y-auto p-4 chat-scrollbar"
                    style={{
                        height: isDetached ? 'calc(100% - 130px)' : 'calc(100vh-160px)'
                    }}
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <p className="text-center">
                                No messages yet.<br />
                                Start a conversation with {otherPartyName}!
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
                                            isOwnMessage={message.senderType === currentUserType}
                                            isAIMode={isAIOpponent}
                                        />
                                    </div>
                                )
                            })}

                            {/* Typing Indicator */}
                            {isOtherTyping && (
                                <TypingIndicator name={otherPartyName} isAI={isAIOpponent} />
                            )}

                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Input Area */}
                <div className={`
                    border-t border-slate-700 p-4 flex-shrink-0
                    ${isDetached ? 'rounded-b-xl' : ''}
                    ${isAIOpponent ? 'bg-amber-900/20' : 'bg-slate-900'}
                `}>
                    <div className="flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                            placeholder={`Message ${otherPartyName}...`}
                            className={`
                                flex-1 text-white placeholder-slate-400 rounded-lg px-4 py-2.5 text-sm 
                                focus:outline-none focus:ring-2
                                ${isAIOpponent
                                    ? 'bg-slate-700/80 focus:ring-amber-500'
                                    : 'bg-slate-700 focus:ring-emerald-500'
                                }
                            `}
                            disabled={isSending}
                        />

                        <button
                            onClick={sendMessage}
                            disabled={!inputText.trim() || isSending}
                            className={`
                                p-2.5 rounded-lg transition-all
                                ${inputText.trim() && !isSending
                                    ? isAIOpponent
                                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                        : 'bg-emerald-500 hover:bg-emerald-600 text-white'
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

export default PartyChatPanel