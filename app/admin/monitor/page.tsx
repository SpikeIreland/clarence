// ============================================================================
// CLARENCE System Observability - Admin Monitoring Dashboard
// File: app/admin/monitor/page.tsx
// Version: 1.0
// Description: Real-time monitoring dashboard for system events
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface RecentEvent {
    event_id: string;
    session_id: string | null;
    journey_type: string;
    step_name: string;
    step_number: number | null;
    status: string;
    source_system: string;
    duration_ms: number | null;
    error_message: string | null;
    created_at: string;
    time_ago: string;
}

interface FailedEvent {
    event_id: string;
    session_id: string | null;
    journey_type: string;
    step_name: string;
    error_message: string | null;
    error_code: string | null;
    source_system: string;
    created_at: string;
    time_ago: string;
}

interface SystemStats {
    total_events_1h: number;
    total_events_24h: number;
    failures_1h: number;
    failures_24h: number;
    active_sessions_1h: number;
    events_by_source: Record<string, number>;
    events_by_journey: Record<string, number>;
    avg_duration_ms: number | null;
}

interface JourneyProgress {
    journeyType: string;
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    percentComplete: number;
    lastActivity: string;
}

type TabType = 'recent' | 'failures' | 'sessions';
type SourceFilter = 'all' | 'frontend' | 'n8n' | 'database' | 'ai';

// ============================================================================
// SECTION 2: HELPER FUNCTIONS
// ============================================================================

function getStatusIcon(status: string): string {
    switch (status) {
        case 'completed': return '✅';
        case 'failed': return '❌';
        case 'started': return '⏳';
        case 'skipped': return '⏭️';
        default: return '❓';
    }
}

function getStatusColor(status: string): string {
    switch (status) {
        case 'completed': return 'text-green-600';
        case 'failed': return 'text-red-600';
        case 'started': return 'text-yellow-600';
        case 'skipped': return 'text-gray-500';
        default: return 'text-gray-600';
    }
}

function formatDuration(ms: number | null): string {
    if (ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

function formatJourneyName(journeyType: string): string {
    return journeyType
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// ============================================================================
// SECTION 3: STATS CARD COMPONENT
// ============================================================================

interface StatsCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    variant?: 'default' | 'success' | 'warning' | 'danger';
}

function StatsCard({ title, value, subtitle, variant = 'default' }: StatsCardProps) {
    const borderColor = {
        default: 'border-gray-200',
        success: 'border-green-500',
        warning: 'border-yellow-500',
        danger: 'border-red-500'
    }[variant];

    const valueColor = {
        default: 'text-gray-900',
        success: 'text-green-600',
        warning: 'text-yellow-600',
        danger: 'text-red-600'
    }[variant];

    return (
        <div className={`bg-white rounded-lg border-l-4 ${borderColor} p-4 shadow-sm`}>
            <p className="text-sm text-gray-500">{title}</p>
            <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
    );
}

// ============================================================================
// SECTION 4: RECENT EVENTS TABLE COMPONENT
// ============================================================================

interface RecentEventsTableProps {
    events: RecentEvent[];
    sourceFilter: SourceFilter;
    onFilterChange: (filter: SourceFilter) => void;
}

function RecentEventsTable({ events, sourceFilter, onFilterChange }: RecentEventsTableProps) {
    const filteredEvents = sourceFilter === 'all'
        ? events
        : events.filter(e => e.source_system === sourceFilter);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Header with Filters */}
            <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Recent Events</h3>
                    <div className="flex gap-2">
                        {(['all', 'frontend', 'n8n', 'database', 'ai'] as SourceFilter[]).map(filter => (
                            <button
                                key={filter}
                                onClick={() => onFilterChange(filter)}
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${sourceFilter === filter
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {filter === 'all' ? 'All' : filter.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Events Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Journey</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredEvents.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                    No events found
                                </td>
                            </tr>
                        ) : (
                            filteredEvents.map(event => (
                                <tr key={event.event_id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm text-gray-600">{event.time_ago}</td>
                                    <td className="px-4 py-2">
                                        <span className={`text-sm ${getStatusColor(event.status)}`}>
                                            {getStatusIcon(event.status)} {event.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                        {formatJourneyName(event.journey_type)}
                                    </td>
                                    <td className="px-4 py-2 text-sm font-mono text-gray-600">
                                        {event.step_name}
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                                            {event.source_system}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-600">
                                        {formatDuration(event.duration_ms)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ============================================================================
// SECTION 5: FAILED EVENTS TABLE COMPONENT
// ============================================================================

interface FailedEventsTableProps {
    failures: FailedEvent[];
}

function FailedEventsTable({ failures }: FailedEventsTableProps) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 bg-red-50">
                <h3 className="font-semibold text-red-900 flex items-center gap-2">
                    ⚠️ Failed Events (Last 24h)
                </h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Journey</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {failures.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-green-600">
                                    ✅ No failures in the last 24 hours
                                </td>
                            </tr>
                        ) : (
                            failures.map(failure => (
                                <tr key={failure.event_id} className="hover:bg-red-50">
                                    <td className="px-4 py-2 text-sm text-gray-600">{failure.time_ago}</td>
                                    <td className="px-4 py-2 text-sm font-mono text-gray-600">
                                        {failure.session_id ? failure.session_id.slice(0, 8) + '...' : '-'}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                        {formatJourneyName(failure.journey_type)}
                                    </td>
                                    <td className="px-4 py-2 text-sm font-mono text-gray-600">
                                        {failure.step_name}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-red-600 max-w-xs truncate">
                                        {failure.error_message || 'No error message'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ============================================================================
// SECTION 6: SESSION LOOKUP COMPONENT
// ============================================================================

interface SessionLookupProps {
    onSearch: (sessionId: string) => void;
    journeyProgress: JourneyProgress[];
    isLoading: boolean;
}

function SessionLookup({ onSearch, journeyProgress, isLoading }: SessionLookupProps) {
    const [sessionId, setSessionId] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (sessionId.trim()) {
            onSearch(sessionId.trim());
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Session Lookup</h3>
            </div>

            <div className="p-4">
                <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={sessionId}
                        onChange={e => setSessionId(e.target.value)}
                        placeholder="Enter session ID..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {isLoading ? 'Loading...' : 'Search'}
                    </button>
                </form>

                {/* Journey Progress */}
                {journeyProgress.length > 0 && (
                    <div className="space-y-3">
                        {journeyProgress.map(journey => (
                            <div key={journey.journeyType} className="border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-gray-900">
                                        {formatJourneyName(journey.journeyType)}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        {journey.completedSteps}/{journey.totalSteps} steps
                                    </span>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all ${journey.failedSteps > 0 ? 'bg-red-500' : 'bg-emerald-500'
                                            }`}
                                        style={{ width: `${journey.percentComplete}%` }}
                                    />
                                </div>

                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-xs text-gray-500">
                                        {journey.percentComplete}% complete
                                    </span>
                                    {journey.failedSteps > 0 && (
                                        <span className="text-xs text-red-500">
                                            {journey.failedSteps} failed
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// SECTION 7: MAIN DASHBOARD COMPONENT
// ============================================================================

export default function MonitorDashboard() {
    // State
    const [activeTab, setActiveTab] = useState<TabType>('recent');
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
    const [events, setEvents] = useState<RecentEvent[]>([]);
    const [failures, setFailures] = useState<FailedEvent[]>([]);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [journeyProgress, setJourneyProgress] = useState<JourneyProgress[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSessionLoading, setIsSessionLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);

    // ============================================================================
    // SECTION 7.1: DATA FETCHING
    // ============================================================================

    const fetchRecentEvents = useCallback(async () => {
        try {
            const response = await fetch('/api/system-events/recent?limit=100');
            const data = await response.json();
            if (data.success) {
                setEvents(data.events);
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to fetch recent events:', error);
        }
    }, []);

    const fetchFailures = useCallback(async () => {
        try {
            const response = await fetch('/api/system-events/failures?hours=24');
            const data = await response.json();
            if (data.success) {
                setFailures(data.failures);
            }
        } catch (error) {
            console.error('Failed to fetch failures:', error);
        }
    }, []);

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        await Promise.all([fetchRecentEvents(), fetchFailures()]);
        setLastRefresh(new Date());
        setIsLoading(false);
    }, [fetchRecentEvents, fetchFailures]);

    const searchSession = async (sessionId: string) => {
        setIsSessionLoading(true);
        try {
            const response = await fetch(`/api/system-events/journey/${sessionId}`);
            const data = await response.json();
            if (data.success) {
                setJourneyProgress(data.journeys);
            }
        } catch (error) {
            console.error('Failed to fetch session:', error);
        }
        setIsSessionLoading(false);
    };

    // ============================================================================
    // SECTION 7.2: EFFECTS
    // ============================================================================

    // Initial load
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Auto-refresh every 10 seconds
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetchAllData();
        }, 10000);

        return () => clearInterval(interval);
    }, [autoRefresh, fetchAllData]);

    // ============================================================================
    // SECTION 7.3: RENDER
    // ============================================================================

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">System Monitor</h1>
                        <p className="text-sm text-gray-500">
                            CLARENCE Observability Dashboard
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={e => setAutoRefresh(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            Auto-refresh
                        </label>
                        <button
                            onClick={fetchAllData}
                            disabled={isLoading}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {isLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                        <span className="text-xs text-gray-400">
                            Last: {lastRefresh.toLocaleTimeString()}
                        </span>
                    </div>
                </div>
            </header>

            <main className="p-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    <StatsCard
                        title="Events (1h)"
                        value={stats?.total_events_1h || 0}
                        subtitle="Total events last hour"
                    />
                    <StatsCard
                        title="Events (24h)"
                        value={stats?.total_events_24h || 0}
                        subtitle="Total events today"
                    />
                    <StatsCard
                        title="Failures (1h)"
                        value={stats?.failures_1h || 0}
                        variant={stats?.failures_1h && stats.failures_1h > 0 ? 'danger' : 'success'}
                        subtitle="Failed events last hour"
                    />
                    <StatsCard
                        title="Active Sessions"
                        value={stats?.active_sessions_1h || 0}
                        subtitle="Unique sessions (1h)"
                    />
                    <StatsCard
                        title="Avg Duration"
                        value={formatDuration(stats?.avg_duration_ms || null)}
                        subtitle="Average step duration"
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                    {(['recent', 'failures', 'sessions'] as TabType[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-md transition-colors ${activeTab === tab
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                }`}
                        >
                            {tab === 'recent' && '📊 Recent Events'}
                            {tab === 'failures' && `⚠️ Failures (${failures.length})`}
                            {tab === 'sessions' && '🔍 Session Lookup'}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'recent' && (
                    <RecentEventsTable
                        events={events}
                        sourceFilter={sourceFilter}
                        onFilterChange={setSourceFilter}
                    />
                )}

                {activeTab === 'failures' && (
                    <FailedEventsTable failures={failures} />
                )}

                {activeTab === 'sessions' && (
                    <SessionLookup
                        onSearch={searchSession}
                        journeyProgress={journeyProgress}
                        isLoading={isSessionLoading}
                    />
                )}
            </main>
        </div>
    );
}

// ============================================================================
// END OF FILE
// ============================================================================