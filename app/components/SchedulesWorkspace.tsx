'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { buildScheduleExpectations } from '@/lib/schedule-types'

interface DetectedScheduleLocal {
  schedule_id: string
  schedule_type: string
  schedule_label: string
  confidence_score: number
  summary: string | null
  status: string
  checklist_status?: string | null
  checklist_score?: number | null
  // Agreement tracking (Phase 2)
  initiator_accepted?: boolean
  respondent_accepted?: boolean
  initiator_accepted_at?: string | null
  respondent_accepted_at?: string | null
  flagged?: boolean
  flagged_by?: string | null
  flagged_reason?: string | null
  flagged_at?: string | null
}

interface ScheduleClauseData {
  clause_id: string
  clause_number: string
  clause_name: string
  category: string
  content: string | null
  original_text: string | null
  clarence_summary: string | null
  clarence_assessment: string | null
  display_order: number
}

interface ChecklistItem {
  result_id: string
  check_question: string
  check_category: string
  check_result: string
  manual_override: string | null
  ai_evidence: string | null
  importance_level: number
}

type PartyRole = 'initiator' | 'respondent'

interface SchedulesWorkspaceProps {
  contractId: string | null
  contractTypeKey: string
  /** Optional: pass pre-loaded schedules to skip the initial fetch */
  initialSchedules?: DetectedScheduleLocal[]
  onScheduleCountChange?: (count: number) => void
  /** Callback when a schedule is selected — parent can use this to drive centre panel */
  onScheduleSelect?: (schedule: DetectedScheduleLocal | null) => void
  /** Which party the current user is — needed for agreement actions */
  partyRole?: PartyRole
  /** Current user's ID — needed for flag attribution */
  userId?: string
  /** Detection status from uploaded_contracts — drives processing spinner */
  detectionStatus?: string | null
}

export default function SchedulesWorkspace({
  contractId,
  contractTypeKey,
  initialSchedules,
  onScheduleCountChange,
  onScheduleSelect,
  partyRole,
  userId,
  detectionStatus,
}: SchedulesWorkspaceProps) {
  const [schedules, setSchedules] = useState<DetectedScheduleLocal[]>(initialSchedules || [])
  const [schedulesLoading, setSchedulesLoading] = useState(false)
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [checklistResults, setChecklistResults] = useState<ChecklistItem[]>([])
  const [checklistScore, setChecklistScore] = useState<number | null>(null)
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [agreementLoading, setAgreementLoading] = useState<string | null>(null) // schedule_id being updated
  const [showFlagInput, setShowFlagInput] = useState<string | null>(null) // schedule_id showing flag reason input
  const [flagReason, setFlagReason] = useState('')
  const [scheduleClauseContent, setScheduleClauseContent] = useState<ScheduleClauseData | null>(null)
  const [clauseContentLoading, setClauseContentLoading] = useState(false)

  // ---- SELF-LOADING: Fetch schedules from API when contractId is available ----
  useEffect(() => {
    if (!contractId) return
    if (initialSchedules && initialSchedules.length > 0) return

    let cancelled = false
    const loadSchedules = async () => {
      setSchedulesLoading(true)
      try {
        const res = await fetch(`/api/contracts/${contractId}/schedules`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setSchedules(data.schedules || [])
          onScheduleCountChange?.(data.schedules?.length || 0)
        }
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setSchedulesLoading(false)
      }
    }
    loadSchedules()
    return () => { cancelled = true }
  }, [contractId, initialSchedules, onScheduleCountChange])

  useEffect(() => {
    if (initialSchedules) {
      setSchedules(initialSchedules)
    }
  }, [initialSchedules])

  // ---- CHECKLIST FUNCTIONS ----
  const fetchChecklist = useCallback(async (cId: string, sId: string) => {
    try {
      setChecklistLoading(true)
      const res = await fetch(`/api/contracts/${cId}/schedules/${sId}/checklist`)
      if (res.ok) {
        const data = await res.json()
        setChecklistResults(data.results || [])
        setChecklistScore(data.checklistScore ?? data.score ?? null)
      }
    } catch {
      // Non-critical
    } finally {
      setChecklistLoading(false)
    }
  }, [])

  const triggerChecklist = useCallback(async (cId: string, sId: string) => {
    try {
      setChecklistLoading(true)
      await fetch(`/api/contracts/${cId}/schedules/${sId}/checklist`, { method: 'POST' })
      await fetchChecklist(cId, sId)
      setSchedules(prev => prev.map(s =>
        s.schedule_id === sId ? { ...s, checklist_status: 'complete', checklist_score: checklistScore } : s
      ))
    } catch {
      setChecklistLoading(false)
    }
  }, [fetchChecklist, checklistScore])

  // ---- AGREEMENT FUNCTIONS (Phase 2) ----
  const handleAgreementAction = useCallback(async (
    scheduleId: string,
    action: 'accept' | 'withdraw' | 'flag' | 'unflag',
    reason?: string
  ) => {
    if (!contractId || !partyRole) return

    setAgreementLoading(scheduleId)
    try {
      const res = await fetch(`/api/contracts/${contractId}/schedules/${scheduleId}/agreement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, partyRole, userId, reason }),
      })
      if (res.ok) {
        const updated = await res.json()
        // Merge agreement fields back into local schedule state
        setSchedules(prev => prev.map(s =>
          s.schedule_id === scheduleId
            ? {
                ...s,
                initiator_accepted: updated.initiator_accepted,
                respondent_accepted: updated.respondent_accepted,
                initiator_accepted_at: updated.initiator_accepted_at,
                respondent_accepted_at: updated.respondent_accepted_at,
                flagged: updated.flagged,
                flagged_by: updated.flagged_by,
                flagged_reason: updated.flagged_reason,
                flagged_at: updated.flagged_at,
              }
            : s
        ))
        setShowFlagInput(null)
        setFlagReason('')
      }
    } catch {
      // Non-critical
    } finally {
      setAgreementLoading(null)
    }
  }, [contractId, partyRole, userId])

  // Load actual clause content from uploaded_contract_clauses matching a schedule label
  const fetchScheduleClauseContent = useCallback(async (schedule: DetectedScheduleLocal) => {
    if (!contractId) return
    setClauseContentLoading(true)
    setScheduleClauseContent(null)
    try {
      const supabase = createClient()
      // Extract schedule number from label (e.g. "Schedule 7 - Pricing" → "Schedule 7")
      const schedNumMatch = schedule.schedule_label.match(/^(Schedule\s+\d+)/i)
      if (!schedNumMatch) { setClauseContentLoading(false); return }
      const schedNum = schedNumMatch[1]

      const { data } = await supabase
        .from('uploaded_contract_clauses')
        .select('clause_id, clause_number, clause_name, category, content, original_text, clarence_summary, clarence_assessment, display_order')
        .eq('contract_id', contractId)
        .ilike('clause_number', schedNum)
        .limit(1)
        .single()

      if (data) {
        setScheduleClauseContent(data as ScheduleClauseData)
      }
    } catch {
      // Non-critical — content just won't show
    } finally {
      setClauseContentLoading(false)
    }
  }, [contractId])

  const handleScheduleClick = useCallback((scheduleId: string) => {
    if (selectedScheduleId === scheduleId) {
      setSelectedScheduleId(null)
      setChecklistResults([])
      setChecklistScore(null)
      setScheduleClauseContent(null)
      onScheduleSelect?.(null)
      return
    }
    setSelectedScheduleId(scheduleId)
    const schedule = schedules.find(s => s.schedule_id === scheduleId)
    if (schedule) {
      onScheduleSelect?.(schedule)
      if (contractId) {
        // Load clause content from uploaded_contract_clauses
        fetchScheduleClauseContent(schedule)
        if (schedule.checklist_status === 'complete') {
          fetchChecklist(contractId, scheduleId)
        } else {
          setChecklistResults([])
          setChecklistScore(null)
        }
      }
    }
  }, [selectedScheduleId, schedules, contractId, fetchChecklist, fetchScheduleClauseContent, onScheduleSelect])

  // ---- AGREEMENT HELPERS ----
  const getScheduleAgreementStatus = (schedule: DetectedScheduleLocal) => {
    const youAccepted = partyRole === 'initiator' ? schedule.initiator_accepted : schedule.respondent_accepted
    const theyAccepted = partyRole === 'initiator' ? schedule.respondent_accepted : schedule.initiator_accepted
    if (youAccepted && theyAccepted) return 'both'
    if (youAccepted) return 'you_only'
    if (theyAccepted) return 'other_only'
    return 'none'
  }

  const expectations = buildScheduleExpectations(contractTypeKey, schedules as any)
  const detectedCount = expectations.filter(e => e.detected).length
  const requiredMissing = expectations.filter(e => e.isRequired && !e.detected)
  const acceptedCount = schedules.filter(s => s.initiator_accepted && s.respondent_accepted).length
  const selectedSchedule = selectedScheduleId ? schedules.find(s => s.schedule_id === selectedScheduleId) : null

  return (
    <div className="flex flex-col h-full">
      {/* Header Summary */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-semibold text-indigo-800">Contract Schedules</h3>
          <span className="text-[10px] font-medium text-indigo-600">
            {detectedCount} of {expectations.length} detected
          </span>
        </div>
        {/* Agreement progress bar */}
        {detectedCount > 0 && partyRole && (
          <div className="mt-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-slate-500">Agreement</span>
              <span className="text-[10px] font-medium text-slate-600">{acceptedCount}/{detectedCount}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${acceptedCount === detectedCount ? 'bg-emerald-500' : 'bg-indigo-400'}`}
                style={{ width: `${detectedCount > 0 ? (acceptedCount / detectedCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
        {requiredMissing.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-[10px] text-red-600 font-medium">
              {requiredMissing.length} required schedule{requiredMissing.length !== 1 ? 's' : ''} missing
            </span>
          </div>
        )}
      </div>

      {/* Schedule List */}
      <div className="flex-1 overflow-y-auto">
        {schedulesLoading || (detectionStatus && detectionStatus !== 'complete' && detectionStatus !== 'failed' && expectations.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-500">
              {detectionStatus === 'processing' || detectionStatus === 'pending'
                ? 'Detecting schedules — this may take a moment...'
                : 'Loading schedules...'}
            </p>
            {(detectionStatus === 'processing' || detectionStatus === 'pending') && (
              <p className="text-[10px] text-slate-400 mt-1">CLARENCE is analysing the document for schedules</p>
            )}
          </div>
        ) : expectations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            {detectionStatus === 'failed' ? (
              <>
                <svg className="w-10 h-10 text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-red-500">Schedule detection encountered an error.</p>
                <p className="text-[10px] text-slate-400 mt-1">Try re-uploading the document or contact support.</p>
              </>
            ) : (
              <>
                <svg className="w-10 h-10 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-xs text-slate-500">No schedules expected for this contract type.</p>
              </>
            )}
          </div>
        ) : (
          <div className="p-3 space-y-1.5">
            {expectations.map(exp => {
              const isClickable = !!exp.detected && !!exp.detectedSchedule
              const isSelected = isClickable && selectedScheduleId === exp.detectedSchedule?.schedule_id
              const schedule = exp.detectedSchedule as DetectedScheduleLocal | undefined
              const agreementStatus = schedule ? getScheduleAgreementStatus(schedule) : 'none'

              return (
                <div
                  key={exp.detectedSchedule?.schedule_id || `missing-${exp.scheduleType}`}
                  onClick={isClickable ? () => handleScheduleClick(exp.detectedSchedule!.schedule_id) : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs transition-all ${
                    isSelected
                      ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300 shadow-sm'
                      : exp.detected
                        ? 'bg-white text-slate-800 hover:bg-indigo-50 cursor-pointer border border-slate-200 hover:border-indigo-200'
                        : exp.isRequired
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-slate-50 text-slate-400 border border-slate-100'
                  }`}
                >
                  {/* Status Icon — shows agreement state for detected schedules */}
                  {exp.detected ? (
                    schedule?.flagged ? (
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0" title="Flagged for review">
                        <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                    ) : agreementStatus === 'both' ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0" title="Both parties accepted">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : agreementStatus === 'you_only' ? (
                      <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0" title="You accepted — awaiting other party">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : agreementStatus === 'other_only' ? (
                      <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0" title="Other party accepted — awaiting you">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )
                  ) : (
                    <div className={`w-5 h-5 rounded-full ${exp.isRequired ? 'bg-red-100' : 'bg-slate-100'} flex items-center justify-center flex-shrink-0`}>
                      <svg className={`w-3 h-3 ${exp.isRequired ? 'text-red-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </div>
                  )}

                  {/* Label and Details */}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{exp.scheduleLabel}</span>
                    {exp.isRequired && !exp.detected && (
                      <span className="text-[10px] text-red-500">Required for this contract type</span>
                    )}
                    {schedule?.flagged && schedule.flagged_reason && (
                      <span className="text-[10px] text-amber-600 truncate block">{schedule.flagged_reason}</span>
                    )}
                  </div>

                  {/* Score Badges */}
                  {exp.detectedSchedule?.checklist_score != null && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      exp.detectedSchedule.checklist_score >= 80 ? 'bg-emerald-100 text-emerald-700'
                      : exp.detectedSchedule.checklist_score >= 50 ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                      {Math.round(exp.detectedSchedule.checklist_score)}%
                    </span>
                  )}
                  {exp.detectedSchedule && !exp.detectedSchedule.checklist_score && exp.detectedSchedule.confidence_score != null && (
                    <span className="text-[10px] text-emerald-600 font-medium">
                      {Math.round(exp.detectedSchedule.confidence_score * 100)}%
                    </span>
                  )}

                  {/* Expand Indicator */}
                  {isClickable && (
                    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${isSelected ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
