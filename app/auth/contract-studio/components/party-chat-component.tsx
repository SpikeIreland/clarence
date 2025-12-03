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
// SECTION 5: MESSAGE BUBBLE COMPONENT
// ============================================================================

interface MessageBubbleProps {
    message: PartyMessage
    isOwnMessage: boolean
}

function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`}>
            <div className={`
                max-w-[80%] rounded-2xl px-4 py-2.5
                ${isOwnMessage
                    ? 'bg-emerald-500 text-white rounded-br-md'
                    : 'bg-slate-700 text-slate-100 rounded-bl-md'
                }
            `}>
                {!isOwnMessage && (
                    <div className="text-xs font-semibold text-emerald-400 mb-1">
                        {message.senderName}
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
                    {isOwnMessage && (
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
        createdAt: apiMsg.created_at
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
    onUnreadCountChange
}: PartyChatPanelProps) {
    // State
    const [messages, setMessages] = useState<PartyMessage[]>([])
    const [inputText, setInputText] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOtherTyping] = useState(false) // For future real-time typing indicators
    const [toasts, setToasts] = useState<ToastNotification[]>([])
    const [lastMessageCount, setLastMessageCount] = useState(0)

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // ============================================================================
    // SECTION 8A: API FUNCTIONS
    // ============================================================================

    const fetchMessages = useCallback(async () => {
        try {
            const response = await fetch(
                `${API_BASE}/party-chat-messages?session_id=${sessionId}&limit=100`
            )

            if (!response.ok) {
                throw new Error('Failed to fetch messages')
            }

            const data = await response.json()

            // Handle response - could be { success, messages } or direct array
            const apiMessages: ApiMessageResponse[] = data.messages || data || []

            // Transform API response to our interface
            const transformedMessages = apiMessages.map(transformApiMessage)

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
            setUnreadCount(unread)
            onUnreadCountChange?.(unread)

        } catch (error) {
            console.error('Failed to fetch messages:', error)
        }
    }, [sessionId, currentUserType, onUnreadCountChange, isOpen, lastMessageCount])

    const sendMessage = async () => {
        if (!inputText.trim() || isSending) return

        setIsSending(true)
        const messageText = inputText.trim()
        setInputText('') // Clear input immediately for better UX

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
                throw new Error('Failed to send message')
            }

            const data = await response.json()

            // Add the new message to local state immediately
            if (data.success && data.message) {
                const newMessage = transformApiMessage(
                    Array.isArray(data.message) ? data.message[0] : data.message
                )
                setMessages(prev => [...prev, newMessage])
                setLastMessageCount(prev => prev + 1)
            } else {
                // Fallback: refetch all messages
                await fetchMessages()
            }

        } catch (error) {
            console.error('Failed to send message:', error)
            // Restore the input text if send failed
            setInputText(messageText)
        } finally {
            setIsSending(false)
        }
    }

    const markAsRead = useCallback(async () => {
        if (unreadCount === 0) return

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
    }, [sessionId, currentUserType, onUnreadCountChange, unreadCount])

    // ============================================================================
    // SECTION 8B: TOAST MANAGEMENT
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
    // SECTION 8C: EFFECTS
    // ============================================================================

    // Initial load
    useEffect(() => {
        setIsLoading(true)
        fetchMessages().finally(() => setIsLoading(false))
    }, []) // Only run once on mount

    // Polling for new messages
    useEffect(() => {
        // Clear any existing interval
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
        }

        // Set up polling based on chat open state
        const pollInterval = isOpen ? 5000 : 15000 // 5s when open, 15s when closed
        pollingIntervalRef.current = setInterval(fetchMessages, pollInterval)

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
            }
        }
    }, [isOpen, fetchMessages])

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

    // ============================================================================
    // SECTION 8D: RENDER
    // ============================================================================

    const otherPartyName = currentUserType === 'customer' ? providerName : 'Customer'

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

    return (
        <>
            {/* Toast Notifications */}
            <ToastContainer
                toasts={toasts}
                onDismiss={dismissToast}
                onOpenChat={() => { }}
            />

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            {/* Slide-Out Panel */}
            <div className={`
                fixed top-0 right-0 h-full w-96 bg-slate-800 shadow-2xl z-50
                transform transition-transform duration-300 ease-out
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                {/* Panel Header */}
                <div className="bg-slate-900 px-4 py-3 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-semibold">
                                    {otherPartyName.charAt(0).toUpperCase()}
                                </span>
                            </div>

                            {/* Name & Status */}
                            <div>
                                <h3 className="font-semibold text-white">{otherPartyName}</h3>
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full ${isProviderOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                                    <span className={`text-xs ${isProviderOnline ? 'text-emerald-400' : 'text-slate-400'}`}>
                                        {isProviderOnline ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                            </div>
                        </div>

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

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto p-4 h-[calc(100vh-160px)] chat-scrollbar">
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
                                        />
                                    </div>
                                )
                            })}

                            {/* Typing Indicator */}
                            {isOtherTyping && <TypingIndicator name={otherPartyName} />}

                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Input Area */}
                <div className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4">
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

export default PartyChatPanel