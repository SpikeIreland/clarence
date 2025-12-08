// ============================================================================
// CLARENCE System Observability - Admin Monitoring Dashboard
// File: app/admin/monitor/page.tsx
// Version: 2.0
// Description: Real-time monitoring dashboard with implementation tracking
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface RecentEvent {
    event_id: string;
    session_id: string | null;
    user_id: string | null;
    journey_type: string;
    step_name: string;
    step_number: number | null;
    status: string;
    source_system: string;
    source_identifier: string | null;
    duration_ms: number | null;
    error_message: string | null;
    created_at: string;
    time_ago: string;
}

interface FailedEvent {
    event_id: string;
    session_id: string | null;
    user_id: string | null;
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
    active_users_1h: number;
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
    events: JourneyEvent[];
}

interface JourneyEvent {
    step_name: string;
    status: string;
    created_at: string;
    time_ago: string;
    error_message?: string | null;
}

interface UserActivity {
    user_id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    total_sessions: number;
    total_events: number;
    first_seen: string;
    last_seen: string;
    sessions: UserSession[];
}

interface UserSession {
    session_id: string;
    session_number: string | null;
    status: string;
    event_count: number;
    last_activity: string;
    journeys: string[];
}

interface ImplementationItem {
    id: string;
    name: string;
    category: string;
    type: 'frontend' | 'n8n';
    journeyType: string;
    expectedEvents: string[];
    status: 'implemented' | 'pending' | 'partial';
    lastEventAt: string | null;
    eventCount24h: number;
}

interface ImplementationStatus {
    frontend: {
        total: number;
        implemented: number;
        items: ImplementationItem[];
    };
    n8n: {
        total: number;
        implemented: number;
        items: ImplementationItem[];
    };
    overallPercentage: number;
}

type TabType = 'recent' | 'failures' | 'sessions' | 'users' | 'implementation';
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

function formatTimeAgo(dateString: string | null): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// ============================================================================
// SECTION 3: STATS CARD COMPONENT
// ============================================================================

interface StatsCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    variant?: 'default' | 'success' | 'warning' | 'danger';
    icon?: string;
}

function StatsCard({ title, value, subtitle, variant = 'default', icon }: StatsCardProps) {
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
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-500">{title}</p>
                    <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
                    {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
                </div>
                {icon && <span className="text-2xl">{icon}</span>}
            </div>
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
    onSessionClick: (sessionId: string) => void;
    onUserClick: (userId: string) => void;
}

function RecentEventsTable({ events, sourceFilter, onFilterChange, onSessionClick, onUserClick }: RecentEventsTableProps) {
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
                                className={`px-3 py-1 text-sm rounded-md transition-colors cursor-pointer ${sourceFilter === filter
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
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredEvents.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
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
                                    <td className="px-4 py-2 text-sm font-mono text-gray-600 max-w-xs truncate" title={event.step_name}>
                                        {event.step_name}
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                                            {event.source_system}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2">
                                        {event.session_id ? (
                                            <button
                                                onClick={() => onSessionClick(event.session_id!)}
                                                className="text-sm text-emerald-600 hover:text-emerald-800 font-mono truncate max-w-[100px] block cursor-pointer"
                                                title={event.session_id}
                                            >
                                                {event.session_id.substring(0, 8)}...
                                            </button>
                                        ) : (
                                            <span className="text-gray-400 text-sm">—</span>
                                        )}
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
    onSessionClick: (sessionId: string) => void;
}

function FailedEventsTable({ failures, onSessionClick }: FailedEventsTableProps) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Failed Events (Last 24h)</h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Journey</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {failures.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                    <span className="text-green-500 text-lg mr-2">✓</span>
                                    No failures in the last 24 hours
                                </td>
                            </tr>
                        ) : (
                            failures.map(failure => (
                                <tr key={failure.event_id} className="hover:bg-red-50">
                                    <td className="px-4 py-2 text-sm text-gray-600">{failure.time_ago}</td>
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                        {formatJourneyName(failure.journey_type)}
                                    </td>
                                    <td className="px-4 py-2 text-sm font-mono text-gray-600">
                                        {failure.step_name}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-red-600 max-w-xs truncate" title={failure.error_message || ''}>
                                        {failure.error_message || '—'}
                                    </td>
                                    <td className="px-4 py-2">
                                        {failure.error_code && (
                                            <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 font-mono">
                                                {failure.error_code}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {failure.session_id ? (
                                            <button
                                                onClick={() => onSessionClick(failure.session_id!)}
                                                className="text-sm text-emerald-600 hover:text-emerald-800 font-mono cursor-pointer"
                                            >
                                                {failure.session_id.substring(0, 8)}...
                                            </button>
                                        ) : (
                                            <span className="text-gray-400 text-sm">—</span>
                                        )}
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
    initialSessionId?: string;
}

function SessionLookup({ onSearch, journeyProgress, isLoading, initialSessionId }: SessionLookupProps) {
    const [searchTerm, setSearchTerm] = useState(initialSessionId || '');

    useEffect(() => {
        if (initialSessionId) {
            setSearchTerm(initialSessionId);
            onSearch(initialSessionId);
        }
    }, [initialSessionId, onSearch]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            onSearch(searchTerm.trim());
        }
    };

    return (
        <div className="space-y-4">
            {/* Search Box */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <form onSubmit={handleSubmit} className="flex gap-3">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Enter session ID (e.g., abc12345-...)"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !searchTerm.trim()}
                        className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {isLoading ? 'Searching...' : 'Search'}
                    </button>
                </form>
            </div>

            {/* Results */}
            {journeyProgress.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900">Session Journey Progress</h3>
                    </div>

                    <div className="p-4 space-y-6">
                        {journeyProgress.map(journey => (
                            <div key={journey.journeyType} className="border border-gray-100 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h4 className="font-medium text-gray-900">{formatJourneyName(journey.journeyType)}</h4>
                                        <p className="text-xs text-gray-500">Last activity: {journey.lastActivity}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-lg font-bold text-emerald-600">{journey.percentComplete}%</span>
                                        <p className="text-xs text-gray-500">{journey.completedSteps}/{journey.totalSteps} steps</p>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                                    <div
                                        className={`h-2 rounded-full transition-all ${journey.failedSteps > 0 ? 'bg-red-500' : 'bg-emerald-500'
                                            }`}
                                        style={{ width: `${journey.percentComplete}%` }}
                                    />
                                </div>

                                {/* Event List */}
                                {journey.events && journey.events.length > 0 && (
                                    <div className="mt-3 space-y-1">
                                        {journey.events.map((event, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                                                <div className="flex items-center gap-2">
                                                    <span>{getStatusIcon(event.status)}</span>
                                                    <span className="font-mono text-gray-600">{event.step_name}</span>
                                                </div>
                                                <span className="text-gray-400 text-xs">{event.time_ago}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {journey.failedSteps > 0 && (
                                    <div className="mt-2 text-xs text-red-500">
                                        ⚠️ {journey.failedSteps} step{journey.failedSteps > 1 ? 's' : ''} failed
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && journeyProgress.length === 0 && searchTerm && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                    <p className="text-gray-500">No events found for this session</p>
                    <p className="text-xs text-gray-400 mt-1">Check the session ID and try again</p>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// SECTION 7: USER LOOKUP COMPONENT
// ============================================================================

interface UserLookupProps {
    onSearch: (query: string) => void;
    userActivity: UserActivity | null;
    isLoading: boolean;
    onSessionClick: (sessionId: string) => void;
}

function UserLookup({ onSearch, userActivity, isLoading, onSessionClick }: UserLookupProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState<'email' | 'user_id'>('email');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            onSearch(`${searchType}:${searchTerm.trim()}`);
        }
    };

    return (
        <div className="space-y-4">
            {/* Search Box */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setSearchType('email')}
                            className={`px-4 py-2 text-sm rounded-lg transition-colors cursor-pointer ${searchType === 'email'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            Search by Email
                        </button>
                        <button
                            type="button"
                            onClick={() => setSearchType('user_id')}
                            className={`px-4 py-2 text-sm rounded-lg transition-colors cursor-pointer ${searchType === 'user_id'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            Search by User ID
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={searchType === 'email' ? 'user@example.com' : 'Enter user ID...'}
                            className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm ${searchType === 'user_id' ? 'font-mono' : ''
                                }`}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !searchTerm.trim()}
                            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isLoading ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Results */}
            {userActivity && (
                <div className="space-y-4">
                    {/* User Info Card */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {userActivity.first_name} {userActivity.last_name}
                                </h3>
                                <p className="text-sm text-gray-500">{userActivity.email}</p>
                                {userActivity.company && (
                                    <p className="text-sm text-gray-400">{userActivity.company}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500">User ID</p>
                                <p className="font-mono text-xs text-gray-600">{userActivity.user_id.substring(0, 12)}...</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{userActivity.total_sessions}</p>
                                <p className="text-xs text-gray-500">Sessions</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-emerald-600">{userActivity.total_events}</p>
                                <p className="text-xs text-gray-500">Total Events</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">{formatTimeAgo(userActivity.first_seen)}</p>
                                <p className="text-xs text-gray-500">First Seen</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">{formatTimeAgo(userActivity.last_seen)}</p>
                                <p className="text-xs text-gray-500">Last Active</p>
                            </div>
                        </div>
                    </div>

                    {/* Sessions List */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="px-4 py-3 border-b border-gray-200">
                            <h3 className="font-semibold text-gray-900">User Sessions</h3>
                        </div>

                        <div className="divide-y divide-gray-100">
                            {userActivity.sessions.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">No sessions found</div>
                            ) : (
                                userActivity.sessions.map(session => (
                                    <div key={session.session_id} className="p-4 hover:bg-gray-50">
                                        <div className="flex items-center justify-between mb-2">
                                            <button
                                                onClick={() => onSessionClick(session.session_id)}
                                                className="font-mono text-sm text-emerald-600 hover:text-emerald-800 cursor-pointer"
                                            >
                                                {session.session_number || session.session_id.substring(0, 12)}...
                                            </button>
                                            <span className={`px-2 py-1 text-xs rounded-full ${session.status === 'active' || session.status === 'negotiation_ready'
                                                    ? 'bg-green-100 text-green-700'
                                                    : session.status === 'completed'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                {session.status}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-sm text-gray-500">
                                            <div className="flex items-center gap-4">
                                                <span>{session.event_count} events</span>
                                                <span>•</span>
                                                <span>{session.journeys.map(j => formatJourneyName(j)).join(', ')}</span>
                                            </div>
                                            <span>{formatTimeAgo(session.last_activity)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !userActivity && searchTerm && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                    <p className="text-gray-500">No user found</p>
                    <p className="text-xs text-gray-400 mt-1">Check the {searchType === 'email' ? 'email address' : 'user ID'} and try again</p>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// SECTION 8: IMPLEMENTATION STATUS COMPONENT
// ============================================================================

function ImplementationStatusTab({ status }: { status: ImplementationStatus | null }) {
    if (!status) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <div className="w-8 h-8 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Loading implementation status...</p>
            </div>
        );
    }

    const frontendCategories = groupByCategory(status.frontend.items);
    const n8nCategories = groupByCategory(status.n8n.items);

    return (
        <div className="space-y-6">
            {/* Overall Progress */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold">Implementation Progress</h2>
                        <p className="text-emerald-100">System observability coverage</p>
                    </div>
                    <div className="text-right">
                        <p className="text-5xl font-bold">{status.overallPercentage}%</p>
                        <p className="text-emerald-100">Complete</p>
                    </div>
                </div>

                <div className="w-full bg-white/20 rounded-full h-4 mb-4">
                    <div
                        className="h-4 rounded-full bg-white transition-all duration-500"
                        style={{ width: `${status.overallPercentage}%` }}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-emerald-100">Frontend Pages</span>
                            <span className="font-bold">{status.frontend.implemented}/{status.frontend.total}</span>
                        </div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-emerald-100">N8N Workflows</span>
                            <span className="font-bold">{status.n8n.implemented}/{status.n8n.total}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Frontend Pages */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">🖥️ Frontend Pages</h3>
                    <span className="text-sm text-gray-500">
                        {status.frontend.implemented} of {status.frontend.total} implemented
                    </span>
                </div>

                <div className="p-4 space-y-4">
                    {Object.entries(frontendCategories).map(([category, items]) => (
                        <div key={category}>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">{category}</h4>
                            <div className="space-y-2">
                                {items.map(item => (
                                    <ImplementationRow key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* N8N Workflows */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">⚙️ N8N Workflows</h3>
                    <span className="text-sm text-gray-500">
                        {status.n8n.implemented} of {status.n8n.total} implemented
                    </span>
                </div>

                <div className="p-4 space-y-4">
                    {Object.entries(n8nCategories).map(([category, items]) => (
                        <div key={category}>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">{category}</h4>
                            <div className="space-y-2">
                                {items.map(item => (
                                    <ImplementationRow key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Legend</h4>
                <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                        <span className="text-gray-600">Implemented & Receiving Events</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                        <span className="text-gray-600">Implemented (No recent events)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-gray-300"></span>
                        <span className="text-gray-600">Not Implemented</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ImplementationRow({ item }: { item: ImplementationItem }) {
    const statusColor = item.status === 'implemented'
        ? (item.eventCount24h > 0 ? 'bg-emerald-500' : 'bg-amber-500')
        : item.status === 'partial'
            ? 'bg-amber-500'
            : 'bg-gray-300';

    const statusIcon = item.status === 'implemented'
        ? (item.eventCount24h > 0 ? '✅' : '⚠️')
        : item.status === 'partial'
            ? '🔶'
            : '⬜';

    return (
        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`}></span>
                <span className="text-sm text-gray-800">{item.name}</span>
                <span className="text-lg">{statusIcon}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
                {item.status === 'implemented' && (
                    <>
                        <span className="text-gray-500">
                            {item.eventCount24h > 0 ? `${item.eventCount24h} events (24h)` : 'No events yet'}
                        </span>
                        <span className="text-gray-400">
                            {item.lastEventAt ? formatTimeAgo(item.lastEventAt) : '—'}
                        </span>
                    </>
                )}
                {item.status === 'pending' && (
                    <span className="text-gray-400">Not started</span>
                )}
            </div>
        </div>
    );
}

function groupByCategory(items: ImplementationItem[]): Record<string, ImplementationItem[]> {
    return items.reduce((acc, item) => {
        if (!acc[item.category]) {
            acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, ImplementationItem[]>);
}

// ============================================================================
// SECTION 9: MAIN DASHBOARD COMPONENT
// ============================================================================

export default function MonitorDashboard() {
    // State
    const [activeTab, setActiveTab] = useState<TabType>('implementation');
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
    const [events, setEvents] = useState<RecentEvent[]>([]);
    const [failures, setFailures] = useState<FailedEvent[]>([]);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [journeyProgress, setJourneyProgress] = useState<JourneyProgress[]>([]);
    const [userActivity, setUserActivity] = useState<UserActivity | null>(null);
    const [implementationStatus, setImplementationStatus] = useState<ImplementationStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSessionLoading, setIsSessionLoading] = useState(false);
    const [isUserLoading, setIsUserLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();

    // ============================================================================
    // SECTION 9.1: DATA FETCHING
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

    const fetchImplementationStatus = useCallback(async () => {
        try {
            const response = await fetch('/api/system-events/implementation-status');
            const data = await response.json();
            if (data.success) {
                setImplementationStatus(data.status);
            }
        } catch (error) {
            console.error('Failed to fetch implementation status:', error);
            // Set mock data if API doesn't exist yet
            setImplementationStatus(getMockImplementationStatus());
        }
    }, []);

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        await Promise.all([
            fetchRecentEvents(),
            fetchFailures(),
            fetchImplementationStatus()
        ]);
        setLastRefresh(new Date());
        setIsLoading(false);
    }, [fetchRecentEvents, fetchFailures, fetchImplementationStatus]);

    const searchSession = useCallback(async (sessionId: string) => {
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
    }, []);

    const searchUser = useCallback(async (query: string) => {
        setIsUserLoading(true);
        setUserActivity(null);
        try {
            const response = await fetch(`/api/system-events/user?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data.success) {
                setUserActivity(data.user);
            }
        } catch (error) {
            console.error('Failed to fetch user:', error);
        }
        setIsUserLoading(false);
    }, []);

    // Handle clicking a session from another tab
    const handleSessionClick = useCallback((sessionId: string) => {
        setSelectedSessionId(sessionId);
        setActiveTab('sessions');
    }, []);

    // ============================================================================
    // SECTION 9.2: EFFECTS
    // ============================================================================

    // Initial load
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetchAllData();
        }, 30000);

        return () => clearInterval(interval);
    }, [autoRefresh, fetchAllData]);

    // ============================================================================
    // SECTION 9.3: RENDER
    // ============================================================================

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">C</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">System Monitor</h1>
                            <p className="text-sm text-gray-500">
                                CLARENCE Observability Dashboard
                            </p>
                        </div>
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
                            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                    <StatsCard
                        title="Events (1h)"
                        value={stats?.total_events_1h || 0}
                        subtitle="Total events last hour"
                        icon="📊"
                    />
                    <StatsCard
                        title="Events (24h)"
                        value={stats?.total_events_24h || 0}
                        subtitle="Total events today"
                        icon="📈"
                    />
                    <StatsCard
                        title="Failures (1h)"
                        value={stats?.failures_1h || 0}
                        variant={stats?.failures_1h && stats.failures_1h > 0 ? 'danger' : 'success'}
                        subtitle="Failed events last hour"
                        icon={stats?.failures_1h && stats.failures_1h > 0 ? '⚠️' : '✅'}
                    />
                    <StatsCard
                        title="Active Sessions"
                        value={stats?.active_sessions_1h || 0}
                        subtitle="Unique sessions (1h)"
                        icon="🔗"
                    />
                    <StatsCard
                        title="Active Users"
                        value={stats?.active_users_1h || 0}
                        subtitle="Unique users (1h)"
                        icon="👥"
                    />
                    <StatsCard
                        title="Avg Duration"
                        value={formatDuration(stats?.avg_duration_ms || null)}
                        subtitle="Average step duration"
                        icon="⏱️"
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4 flex-wrap">
                    {([
                        { id: 'implementation', label: '📋 Implementation', badge: `${implementationStatus?.overallPercentage || 0}%` },
                        { id: 'recent', label: '📊 Recent Events' },
                        { id: 'failures', label: '⚠️ Failures', badge: failures.length > 0 ? failures.length.toString() : undefined },
                        { id: 'sessions', label: '🔍 Session Lookup' },
                        { id: 'users', label: '👤 User Lookup' },
                    ] as { id: TabType; label: string; badge?: string }[]).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 cursor-pointer ${activeTab === tab.id
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                }`}
                        >
                            {tab.label}
                            {tab.badge && (
                                <span className={`px-2 py-0.5 text-xs rounded-full ${activeTab === tab.id
                                        ? 'bg-white/20 text-white'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'implementation' && (
                    <ImplementationStatusTab status={implementationStatus} />
                )}

                {activeTab === 'recent' && (
                    <RecentEventsTable
                        events={events}
                        sourceFilter={sourceFilter}
                        onFilterChange={setSourceFilter}
                        onSessionClick={handleSessionClick}
                        onUserClick={(userId) => {
                            setActiveTab('users');
                            searchUser(`user_id:${userId}`);
                        }}
                    />
                )}

                {activeTab === 'failures' && (
                    <FailedEventsTable
                        failures={failures}
                        onSessionClick={handleSessionClick}
                    />
                )}

                {activeTab === 'sessions' && (
                    <SessionLookup
                        onSearch={searchSession}
                        journeyProgress={journeyProgress}
                        isLoading={isSessionLoading}
                        initialSessionId={selectedSessionId}
                    />
                )}

                {activeTab === 'users' && (
                    <UserLookup
                        onSearch={searchUser}
                        userActivity={userActivity}
                        isLoading={isUserLoading}
                        onSessionClick={handleSessionClick}
                    />
                )}
            </main>
        </div>
    );
}

// ============================================================================
// SECTION 10: MOCK DATA FOR IMPLEMENTATION STATUS
// ============================================================================

function getMockImplementationStatus(): ImplementationStatus {
    return {
        frontend: {
            total: 14,
            implemented: 10,
            items: [
                // Customer Journey
                { id: 'signup', name: 'Signup Page', category: 'Customer Journey', type: 'frontend', journeyType: 'customer_onboarding', expectedEvents: ['signup_page_loaded', 'signup_form_submitted'], status: 'implemented', lastEventAt: null, eventCount24h: 0 },
                { id: 'callback', name: 'Auth Callback', category: 'Customer Journey', type: 'frontend', journeyType: 'customer_onboarding', expectedEvents: ['verification_completed'], status: 'implemented', lastEventAt: null, eventCount24h: 0 },
                { id: 'dashboard', name: 'Contract Dashboard', category: 'Customer Journey', type: 'frontend', journeyType: 'contract_session_creation', expectedEvents: ['dashboard_loaded', 'create_contract_clicked'], status: 'implemented', lastEventAt: null, eventCount24h: 0 },
                { id: 'requirements', name: 'Customer Requirements', category: 'Customer Journey', type: 'frontend', journeyType: 'customer_requirements', expectedEvents: ['requirements_form_loaded', 'requirements_form_submitted'], status: 'implemented', lastEventAt: null, eventCount24h: 0 },
                { id: 'assessment', name: 'Strategic Assessment', category: 'Customer Journey', type: 'frontend', journeyType: 'customer_questionnaire', expectedEvents: ['questionnaire_page_loaded', 'questionnaire_form_submitted'], status: 'implemented', lastEventAt: null, eventCount24h: 0 },
                // Provider Journey
                { id: 'provider-landing', name: 'Provider Landing', category: 'Provider Journey', type: 'frontend', journeyType: 'provider_onboarding', expectedEvents: ['invitation_link_clicked', 'provider_portal_loaded'], status: 'implemented', lastEventAt: null, eventCount24h: 0 },
                { id: 'provider-welcome', name: 'Provider Welcome', category: 'Provider Journey', type: 'frontend', journeyType: 'provider_onboarding', expectedEvents: ['provider_welcome_page_loaded'], status: 'implemented', lastEventAt: null, eventCount24h: 0 },
                { id: 'provider-intake', name: 'Provider Intake', category: 'Provider Journey', type: 'frontend', journeyType: 'provider_onboarding', expectedEvents: ['provider_intake_form_loaded', 'provider_capabilities_submitted'], status: 'implemented', lastEventAt: null, eventCount24h: 0 },
                { id: 'provider-questionnaire', name: 'Provider Questionnaire', category: 'Provider Journey', type: 'frontend', journeyType: 'provider_questionnaire', expectedEvents: ['provider_questionnaire_page_loaded', 'provider_questionnaire_submitted'], status: 'implemented', lastEventAt: null, eventCount24h: 0 },
                { id: 'provider-confirmation', name: 'Provider Confirmation', category: 'Provider Journey', type: 'frontend', journeyType: 'provider_onboarding', expectedEvents: ['provider_confirmation_page_loaded'], status: 'implemented', lastEventAt: null, eventCount24h: 0 },
                // Contract Studio
                { id: 'contract-studio', name: 'Contract Studio', category: 'Contract Negotiation', type: 'frontend', journeyType: 'contract_negotiation', expectedEvents: ['contract_studio_loaded', 'clause_selected'], status: 'implemented', lastEventAt: null, eventCount24h: 0 },
                // Pre-Auth (Optional)
                { id: 'home', name: 'Home Page', category: 'Pre-Auth (Optional)', type: 'frontend', journeyType: '-', expectedEvents: [], status: 'pending', lastEventAt: null, eventCount24h: 0 },
                { id: 'how-it-works', name: 'How It Works', category: 'Pre-Auth (Optional)', type: 'frontend', journeyType: '-', expectedEvents: [], status: 'pending', lastEventAt: null, eventCount24h: 0 },
                { id: 'phases', name: 'Phases Page', category: 'Pre-Auth (Optional)', type: 'frontend', journeyType: '-', expectedEvents: [], status: 'pending', lastEventAt: null, eventCount24h: 0 },
            ],
        },
        n8n: {
            total: 11,
            implemented: 0,
            items: [
                // Customer Workflows
                { id: 'n8n-customer-requirements', name: '1.0 Customer Requirements', category: 'Customer Workflows', type: 'n8n', journeyType: 'customer_requirements', expectedEvents: ['customer_requirements_workflow_triggered'], status: 'pending', lastEventAt: null, eventCount24h: 0 },
                { id: 'n8n-customer-questionnaire', name: '1.1 Customer Questionnaire', category: 'Customer Workflows', type: 'n8n', journeyType: 'customer_questionnaire', expectedEvents: ['customer_questionnaire_workflow_triggered'], status: 'pending', lastEventAt: null, eventCount24h: 0 },
                // Provider Workflows
                { id: 'n8n-provider-invite', name: '2.0 Provider Invite', category: 'Provider Workflows', type: 'n8n', journeyType: 'provider_invitation', expectedEvents: ['provider_invite_workflow_triggered'], status: 'pending', lastEventAt: null, eventCount24h: 0 },
                { id: 'n8n-provider-intake', name: '2.1 Provider Intake', category: 'Provider Workflows', type: 'n8n', journeyType: 'provider_onboarding', expectedEvents: ['provider_intake_workflow_triggered'], status: 'pending', lastEventAt: null, eventCount24h: 0 },
                { id: 'n8n-token-validation', name: '2.2 Token Validation', category: 'Provider Workflows', type: 'n8n', journeyType: 'provider_onboarding', expectedEvents: ['token_validation_workflow_triggered'], status: 'pending', lastEventAt: null, eventCount24h: 0 },
                { id: 'n8n-provider-questionnaire', name: '2.3 Provider Questionnaire', category: 'Provider Workflows', type: 'n8n', journeyType: 'provider_questionnaire', expectedEvents: ['provider_questionnaire_workflow_triggered'], status: 'pending', lastEventAt: null, eventCount24h: 0 },
                // Processing Workflows
                { id: 'n8n-leverage', name: '3.0 Leverage Calculation', category: 'Processing Workflows', type: 'n8n', journeyType: 'leverage_calculation', expectedEvents: ['leverage_workflow_triggered'], status: 'pending', lastEventAt: null, eventCount24h: 0 },
                { id: 'n8n-clause-positions', name: '3.1 Clause Positions', category: 'Processing Workflows', type: 'n8n', journeyType: 'leverage_calculation', expectedEvents: ['clause_positions_workflow_triggered'], status: 'pending', lastEventAt: null, eventCount24h: 0 },
                { id: 'n8n-clarence-ai', name: '3.4 CLARENCE AI', category: 'Processing Workflows', type: 'n8n', journeyType: 'clarence_chat', expectedEvents: ['clarence_chat_workflow_triggered'], status: 'pending', lastEventAt: null, eventCount24h: 0 },
                // API Workflows
                { id: 'n8n-contract-studio-api', name: '4.0 Contract Studio API', category: 'API Workflows', type: 'n8n', journeyType: 'contract_studio', expectedEvents: ['contract_studio_api_triggered'], status: 'pending', lastEventAt: null, eventCount24h: 0 },
                { id: 'n8n-dashboard-api', name: '4.1 Dashboard API', category: 'API Workflows', type: 'n8n', journeyType: 'contract_session_creation', expectedEvents: ['dashboard_api_triggered'], status: 'pending', lastEventAt: null, eventCount24h: 0 },
            ],
        },
        overallPercentage: 40, // 10/25 items
    };
}

// ============================================================================
// END OF FILE
// ============================================================================