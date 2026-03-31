'use client'

import React from 'react'

export type StudioTab = 'clauses' | 'schedules'

interface StudioTabSwitcherProps {
  activeTab: StudioTab
  onTabChange: (tab: StudioTab) => void
  clauseCount: number
  scheduleCount: number
  missingRequiredCount?: number
  /** Number of schedules where both parties have accepted */
  acceptedCount?: number
  /** Number of schedules currently flagged for review */
  flaggedCount?: number
}

export default function StudioTabSwitcher({
  activeTab,
  onTabChange,
  clauseCount,
  scheduleCount,
  missingRequiredCount = 0,
  acceptedCount = 0,
  flaggedCount = 0,
}: StudioTabSwitcherProps) {
  return (
    <div className="flex border-b border-slate-200 bg-slate-50 flex-shrink-0">
      {/* Clauses Tab */}
      <button
        onClick={() => onTabChange('clauses')}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative ${
          activeTab === 'clauses'
            ? 'text-emerald-700 bg-white border-b-2 border-emerald-600'
            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Clauses
        {clauseCount > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            activeTab === 'clauses' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
          }`}>
            {clauseCount}
          </span>
        )}
      </button>

      {/* Schedules Tab */}
      <button
        onClick={() => onTabChange('schedules')}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative ${
          activeTab === 'schedules'
            ? 'text-indigo-700 bg-white border-b-2 border-indigo-600'
            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Schedules
        {scheduleCount > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            acceptedCount === scheduleCount && scheduleCount > 0
              ? 'bg-emerald-100 text-emerald-700'
              : activeTab === 'schedules' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
          }`}>
            {acceptedCount > 0 ? `${acceptedCount}/${scheduleCount}` : scheduleCount}
          </span>
        )}
        {/* Red dot for missing required schedules */}
        {missingRequiredCount > 0 && (
          <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full" />
        )}
        {/* Amber dot for flagged schedules (only if no red dot) */}
        {missingRequiredCount === 0 && flaggedCount > 0 && (
          <span className="absolute top-1.5 right-2 w-2 h-2 bg-amber-500 rounded-full" />
        )}
      </button>
    </div>
  )
}
