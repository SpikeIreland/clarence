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
// SECTION 6: MAIN PARTY CHAT PANEL COMPONENT
// ============================================================================

export function PartyChatPanel({
    sessionId,
    providerId,
    providerName,
    currentUserType,
    currentUserName,
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
    const [isOtherTyping, setIsOtherTyping] = useState(false)
    const [toasts, setToasts] = useState<ToastNotification[]>([])

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // ============================================================================
    // SECTION 6A: MOCK DATA FOR DEMOS
    // ============================================================================

    const mockMessages: PartyMessage[] = [
        {
            messageId: '1',
            sessionId,
            providerId,
            senderType: 'provider',
            senderName: providerName,
            messageText: 'Hi there! I\'ve reviewed your initial requirements and I think we can work together on this contract. Do you have any initial concerns about the liability clauses?',
            isRead: true,
            createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
            messageId: '2',
            sessionId,
            providerId,
            senderType: 'customer',
            senderName: currentUserName,
            messageText: 'Thanks for reaching out! Yes, we\'re particularly focused on ensuring the liability cap is reasonable given the deal value. What\'s your standard approach?',
            isRead: true,
            createdAt: new Date(Date.now() - 3000000).toISOString()
        },
        {
            messageId: '3',
            sessionId,
            providerId,
            senderType: 'provider',
            senderName: providerName,
            messageText: 'We typically cap liability at 100% of annual contract value for general claims, with carve-outs for data breaches where we offer higher coverage. Would that work for your requirements?',
            isRead: true,
            createdAt: new Date(Date.now() - 2400000).toISOString()
        },
        {
            messageId: '4',
            sessionId,
            providerId,
            senderType: 'customer',
            senderName: currentUserName,
            messageText: 'That sounds reasonable as a starting point. Let me discuss with my team and get back to you. In the meantime, I\'ve adjusted our position on Payment Terms - can you take a look?',
            isRead: true,
            createdAt: new Date(Date.now() - 1800000).toISOString()
        },
        {
            messageId: '5',
            sessionId,
            providerId,
            senderType: 'provider',
            senderName: providerName,
            messageText: 'I see the change to 45-day payment terms. That works for us. I\'ll update our position to match. Looking forward to progressing on the remaining clauses!',
            isRead: false,
            createdAt: new Date(Date.now() - 300000).toISOString()
        }
    ]

    // ============================================================================
    // SECTION 6B: API FUNCTIONS (Placeholders for N8N integration)
    // ============================================================================

    const fetchMessages = useCallback(async () => {
        try {
            // TODO: Replace with actual N8N webhook call
            // const response = await fetch(`/api/n8n/party-chat-messages?sessionId=${sessionId}&providerId=${providerId}`)
            // const data = await response.json()
            // setMessages(data.messages)

            // For demo: Use mock data
            setMessages(mockMessages)

            // Calculate unread count
            const unread = mockMessages.filter(
                m => !m.isRead && m.senderType !== currentUserType
            ).length
            setUnreadCount(unread)
            onUnreadCountChange?.(unread)

        } catch (error) {
            console.error('Failed to fetch messages:', error)
        }
    }, [sessionId, providerId, currentUserType, onUnreadCountChange, providerName, currentUserName])

    const sendMessage = async () => {
        if (!inputText.trim() || isSending) return

        setIsSending(true)

        try {
            // TODO: Replace with actual N8N webhook call
            // await fetch('/api/n8n/party-chat-send', { ... })

            // For demo: Add message locally
            const newMessage: PartyMessage = {
                messageId: Date.now().toString(),
                sessionId,
                providerId,
                senderType: currentUserType,
                senderName: currentUserName,
                messageText: inputText.trim(),
                isRead: false,
                createdAt: new Date().toISOString()
            }

            setMessages(prev => [...prev, newMessage])
            setInputText('')

            // Simulate provider response for demo
            setTimeout(() => {
                setIsOtherTyping(true)
                setTimeout(() => {
                    setIsOtherTyping(false)
                    const responseMessage: PartyMessage = {
                        messageId: (Date.now() + 1).toString(),
                        sessionId,
                        providerId,
                        senderType: 'provider',
                        senderName: providerName,
                        messageText: 'Thanks for that update. I\'ll review and respond shortly.',
                        isRead: false,
                        createdAt: new Date().toISOString()
                    }
                    setMessages(prev => [...prev, responseMessage])

                    // Show toast if chat is closed
                    if (!isOpen) {
                        addToast(responseMessage)
                    }
                }, 2000)
            }, 1000)

        } catch (error) {
            console.error('Failed to send message:', error)
        } finally {
            setIsSending(false)
        }
    }

    const markAsRead = useCallback(async () => {
        try {
            // TODO: Replace with actual N8N webhook call

            // For demo: Mark all as read locally
            setMessages(prev => prev.map(m => ({
                ...m,
                isRead: true,
                readAt: m.isRead ? m.readAt : new Date().toISOString()
            })))
            setUnreadCount(0)
            onUnreadCountChange?.(0)

        } catch (error) {
            console.error('Failed to mark messages as read:', error)
        }
    }, [onUnreadCountChange])

    // ============================================================================
    // SECTION 6C: TOAST MANAGEMENT
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

        // Update unread count
        setUnreadCount(prev => prev + 1)
        onUnreadCountChange?.(unreadCount + 1)
    }

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    // ============================================================================
    // SECTION 6D: EFFECTS
    // ============================================================================

    // Initial load
    useEffect(() => {
        fetchMessages()
    }, [fetchMessages])

    // Polling for new messages
    useEffect(() => {
        if (isOpen) {
            pollingIntervalRef.current = setInterval(fetchMessages, 10000)
        } else {
            pollingIntervalRef.current = setInterval(fetchMessages, 30000)
        }

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
            }
        }
    }, [isOpen, fetchMessages])

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (isOpen) {
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
    // SECTION 6E: RENDER
    // ============================================================================

    const otherPartyName = currentUserType === 'customer' ? providerName : 'Customer'

    return (
        <>
            {/* Toast Notifications */}
            <ToastContainer
                toasts={toasts}
                onDismiss={dismissToast}
                onOpenChat={() => { }} // Toast click handled by parent
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
                            {/* Date Divider */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex-1 h-px bg-slate-700" />
                                <span className="text-xs text-slate-500">Today</span>
                                <div className="flex-1 h-px bg-slate-700" />
                            </div>

                            {/* Messages */}
                            {messages.map(message => (
                                <MessageBubble
                                    key={message.messageId}
                                    message={message}
                                    isOwnMessage={message.senderType === currentUserType}
                                />
                            ))}

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