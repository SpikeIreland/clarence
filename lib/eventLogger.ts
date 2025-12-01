// ============================================================================
// CLARENCE System Observability - Frontend Event Logger
// File: lib/eventLogger.ts
// Version: 1.0
// Description: Utility class for logging events from the frontend
// ============================================================================

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

/**
 * Event status types
 */
export type EventStatus = 'started' | 'completed' | 'failed' | 'skipped';

/**
 * Step categories for classification
 */
export type StepCategory = 'auth' | 'frontend' | 'workflow' | 'database' | 'external' | 'ai';

/**
 * Journey types matching the database definitions
 */
export type JourneyType =
    | 'customer_onboarding'
    | 'contract_session_creation'
    | 'customer_requirements'
    | 'customer_questionnaire'
    | 'provider_invitation'
    | 'provider_onboarding'
    | 'provider_questionnaire'
    | 'leverage_calculation'
    | 'contract_studio'
    | 'clause_negotiation'
    | 'clarence_chat'
    | 'tradeoff_analysis'
    | 'draft_generation';

/**
 * Event payload structure for API calls
 */
export interface EventPayload {
    journeyType: JourneyType | string;
    stepName: string;
    stepNumber?: number;
    stepCategory?: StepCategory;
    status: EventStatus;
    context?: Record<string, unknown>;
    errorMessage?: string;
    errorCode?: string;
}

/**
 * API response structure
 */
export interface EventResponse {
    success: boolean;
    eventId?: string;
    error?: string;
}

/**
 * Event timing for duration tracking
 */
interface EventTiming {
    journeyType: string;
    stepName: string;
    startedAt: Date;
}

// ============================================================================
// SECTION 2: EVENT LOGGER CLASS
// ============================================================================

/**
 * EventLogger class for tracking user journey events
 * 
 * Usage:
 * ```typescript
 * import { eventLogger } from '@/lib/eventLogger';
 * 
 * // Set session context
 * eventLogger.setSession(sessionId);
 * eventLogger.setUser(userId);
 * 
 * // Log events
 * eventLogger.completed('customer_requirements', 'requirements_form_loaded');
 * ```
 */
class EventLogger {
    // ============================================================================
    // SECTION 2.1: PRIVATE PROPERTIES
    // ============================================================================

    private sessionId: string | null = null;
    private userId: string | null = null;
    private traceId: string | null = null;
    private activeTimings: Map<string, EventTiming> = new Map();
    private isEnabled: boolean = true;
    private apiEndpoint: string = '/api/system-events';
    private batchQueue: EventPayload[] = [];
    private batchTimeout: ReturnType<typeof setTimeout> | null = null;
    private batchDelay: number = 100; // ms to wait before sending batch

    // ============================================================================
    // SECTION 2.2: CONFIGURATION METHODS
    // ============================================================================

    /**
     * Set the current session ID
     * This also sets the trace_id by default
     */
    setSession(sessionId: string): void {
        this.sessionId = sessionId;
        this.traceId = sessionId; // Use session as trace by default
    }

    /**
     * Set the current user ID
     */
    setUser(userId: string): void {
        this.userId = userId;
    }

    /**
     * Set a custom trace ID (for linking related events across sessions)
     */
    setTraceId(traceId: string): void {
        this.traceId = traceId;
    }

    /**
     * Enable or disable logging (useful for development/testing)
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
    }

    /**
     * Set custom API endpoint (for testing or different environments)
     */
    setApiEndpoint(endpoint: string): void {
        this.apiEndpoint = endpoint;
    }

    /**
     * Clear all context (useful when user logs out)
     */
    clearContext(): void {
        this.sessionId = null;
        this.userId = null;
        this.traceId = null;
        this.activeTimings.clear();
    }

    // ============================================================================
    // SECTION 2.3: CORE LOGGING METHOD
    // ============================================================================

    /**
     * Log an event to the system
     * This is the main method - all other methods call this
     */
    async log(payload: EventPayload): Promise<EventResponse | null> {
        if (!this.isEnabled) {
            return null;
        }

        try {
            // Check if we're in a browser environment
            if (typeof window === 'undefined') {
                console.warn('EventLogger: Cannot log events in server-side context');
                return null;
            }

            const fullPayload = {
                ...payload,
                sessionId: this.sessionId,
                userId: this.userId,
                traceId: this.traceId,
                sourceSystem: 'frontend',
                sourceIdentifier: window.location.pathname,
                timestamp: new Date().toISOString()
            };

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fullPayload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result: EventResponse = await response.json();
            return result;

        } catch (error) {
            // Silent fail - don't break user experience for logging
            console.error('EventLogger: Event logging failed:', error);
            return null;
        }
    }

    // ============================================================================
    // SECTION 2.4: CONVENIENCE METHODS
    // ============================================================================

    /**
     * Log a "started" event
     * Starts timing for duration calculation
     */
    started(
        journeyType: JourneyType | string,
        stepName: string,
        context?: Record<string, unknown>
    ): Promise<EventResponse | null> {
        // Store timing for duration calculation
        const timingKey = `${journeyType}:${stepName}`;
        this.activeTimings.set(timingKey, {
            journeyType,
            stepName,
            startedAt: new Date()
        });

        return this.log({
            journeyType,
            stepName,
            status: 'started',
            context
        });
    }

    /**
     * Log a "completed" event
     * If a matching "started" event exists, calculates duration
     */
    completed(
        journeyType: JourneyType | string,
        stepName: string,
        context?: Record<string, unknown>
    ): Promise<EventResponse | null> {
        // Check for timing to calculate duration
        const timingKey = `${journeyType}:${stepName}`;
        const timing = this.activeTimings.get(timingKey);

        let enrichedContext = { ...context };

        if (timing) {
            const durationMs = new Date().getTime() - timing.startedAt.getTime();
            enrichedContext = {
                ...enrichedContext,
                durationMs,
                startedAt: timing.startedAt.toISOString()
            };
            this.activeTimings.delete(timingKey);
        }

        return this.log({
            journeyType,
            stepName,
            status: 'completed',
            context: enrichedContext
        });
    }

    /**
     * Log a "failed" event with error details
     */
    failed(
        journeyType: JourneyType | string,
        stepName: string,
        errorMessage: string,
        errorCode?: string,
        context?: Record<string, unknown>
    ): Promise<EventResponse | null> {
        // Clean up any active timing
        const timingKey = `${journeyType}:${stepName}`;
        this.activeTimings.delete(timingKey);

        return this.log({
            journeyType,
            stepName,
            status: 'failed',
            errorMessage,
            errorCode,
            context
        });
    }

    /**
     * Log a "skipped" event
     */
    skipped(
        journeyType: JourneyType | string,
        stepName: string,
        reason?: string,
        context?: Record<string, unknown>
    ): Promise<EventResponse | null> {
        return this.log({
            journeyType,
            stepName,
            status: 'skipped',
            context: {
                ...context,
                skipReason: reason
            }
        });
    }

    // ============================================================================
    // SECTION 2.5: JOURNEY-SPECIFIC HELPER METHODS
    // ============================================================================

    /**
     * Log page load event
     * Automatically captures URL and timing
     */
    pageLoaded(
        journeyType: JourneyType | string,
        pageName: string,
        additionalContext?: Record<string, unknown>
    ): Promise<EventResponse | null> {
        const context: Record<string, unknown> = {
            ...additionalContext,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
            referrer: typeof document !== 'undefined' ? document.referrer : undefined
        };

        // Add performance timing if available
        if (typeof window !== 'undefined' && window.performance) {
            const timing = window.performance.timing;
            if (timing.loadEventEnd > 0) {
                context.pageLoadTime = timing.loadEventEnd - timing.navigationStart;
            }
        }

        return this.completed(journeyType, `${pageName}_loaded`, context);
    }

    /**
     * Log form submission event
     */
    formSubmitted(
        journeyType: JourneyType | string,
        formName: string,
        formData?: Record<string, unknown>
    ): Promise<EventResponse | null> {
        return this.completed(journeyType, `${formName}_submitted`, {
            formData: formData ? this.sanitizeFormData(formData) : undefined
        });
    }

    /**
     * Log button click event
     */
    buttonClicked(
        journeyType: JourneyType | string,
        buttonName: string,
        context?: Record<string, unknown>
    ): Promise<EventResponse | null> {
        return this.completed(journeyType, `${buttonName}_clicked`, context);
    }

    /**
     * Log redirect/navigation event
     */
    redirected(
        journeyType: JourneyType | string,
        destination: string,
        context?: Record<string, unknown>
    ): Promise<EventResponse | null> {
        return this.completed(journeyType, `redirect_to_${destination}`, {
            ...context,
            fromUrl: typeof window !== 'undefined' ? window.location.href : undefined
        });
    }

    // ============================================================================
    // SECTION 2.6: UTILITY METHODS
    // ============================================================================

    /**
     * Sanitize form data to remove sensitive information
     */
    private sanitizeFormData(data: Record<string, unknown>): Record<string, unknown> {
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key', 'credit_card', 'ssn'];
        const sanitized: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();
            if (sensitiveFields.some(field => lowerKey.includes(field))) {
                sanitized[key] = '[REDACTED]';
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Get current context (for debugging)
     */
    getContext(): { sessionId: string | null; userId: string | null; traceId: string | null } {
        return {
            sessionId: this.sessionId,
            userId: this.userId,
            traceId: this.traceId
        };
    }

    /**
     * Check if logger has required context
     */
    hasRequiredContext(): boolean {
        return this.sessionId !== null;
    }
}

// ============================================================================
// SECTION 3: SINGLETON EXPORT
// ============================================================================

/**
 * Singleton instance of the EventLogger
 * Import this in your components
 */
export const eventLogger = new EventLogger();

// ============================================================================
// SECTION 4: REACT HOOK (OPTIONAL)
// ============================================================================

/**
 * React hook for event logging with automatic context
 * 
 * Usage:
 * ```typescript
 * const { logEvent, logCompleted, logFailed } = useEventLogger(sessionId, userId);
 * ```
 */
export function useEventLogger(sessionId?: string, userId?: string) {
    // Set context if provided
    if (sessionId) {
        eventLogger.setSession(sessionId);
    }
    if (userId) {
        eventLogger.setUser(userId);
    }

    return {
        logEvent: eventLogger.log.bind(eventLogger),
        started: eventLogger.started.bind(eventLogger),
        completed: eventLogger.completed.bind(eventLogger),
        failed: eventLogger.failed.bind(eventLogger),
        skipped: eventLogger.skipped.bind(eventLogger),
        pageLoaded: eventLogger.pageLoaded.bind(eventLogger),
        formSubmitted: eventLogger.formSubmitted.bind(eventLogger),
        buttonClicked: eventLogger.buttonClicked.bind(eventLogger),
        redirected: eventLogger.redirected.bind(eventLogger),
        setSession: eventLogger.setSession.bind(eventLogger),
        setUser: eventLogger.setUser.bind(eventLogger),
        clearContext: eventLogger.clearContext.bind(eventLogger)
    };
}

// ============================================================================
// SECTION 5: USAGE EXAMPLES (COMMENTS)
// ============================================================================

/*
USAGE EXAMPLES:

1. Initialize on page load (in a layout or page component):
   
   useEffect(() => {
     eventLogger.setSession(sessionId);
     eventLogger.setUser(userId);
     eventLogger.pageLoaded('customer_requirements', 'requirements_form');
   }, [sessionId, userId]);

2. Form submission with error handling:

   const handleSubmit = async () => {
     eventLogger.started('customer_requirements', 'requirements_form_submitted');
     
     try {
       const response = await fetch('/api/submit', { ... });
       if (response.ok) {
         eventLogger.completed('customer_requirements', 'requirements_form_submitted');
         eventLogger.redirected('customer_requirements', 'questionnaire');
         router.push('/questionnaire');
       } else {
         throw new Error('Submission failed');
       }
     } catch (error) {
       eventLogger.failed(
         'customer_requirements',
         'requirements_form_submitted',
         error.message,
         'SUBMIT_ERROR'
       );
     }
   };

3. Button click tracking:

   const handleCreateContract = () => {
     eventLogger.buttonClicked('contract_session_creation', 'create_contract');
     router.push('/auth/customer-requirements');
   };

4. Questionnaire progress tracking:

   const handleQuestionAnswered = (questionNumber: number) => {
     eventLogger.completed(
       'customer_questionnaire',
       `questionnaire_q${questionNumber}_answered`,
       { questionNumber, answeredAt: new Date().toISOString() }
     );
   };

5. CLARENCE chat tracking:

   const handleSendMessage = async (message: string) => {
     eventLogger.completed('clarence_chat', 'chat_message_entered');
     eventLogger.started('clarence_chat', 'chat_message_submitted');
     
     try {
       const response = await sendToClareence(message);
       eventLogger.completed('clarence_chat', 'clarence_response_rendered', {
         responseLength: response.length
       });
     } catch (error) {
       eventLogger.failed(
         'clarence_chat',
         'chat_message_submitted',
         error.message
       );
     }
   };
*/