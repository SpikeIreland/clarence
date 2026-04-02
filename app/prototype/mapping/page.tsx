'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'

// Inline SVG icons to avoid dependency issues
const SearchIcon = () => (
  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)
const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)
const XIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export default function MappingWorkspacePrototype() {
  // Real data from CapGemini MSA playbook + template
  const rules = [
    { rule_id: '97cadb97', clause_name: 'Client Policy Alignment', category: 'data_protection', ideal_position: 7, minimum_position: 4, maximum_position: 9, fallback_position: 6, importance_level: 8, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: '5dceb8ba', clause_name: 'Data Protection Scope Requirements', category: 'data_protection', ideal_position: 8, minimum_position: 6, maximum_position: 10, fallback_position: 7, importance_level: 9, is_deal_breaker: false, is_non_negotiable: true },
    { rule_id: '69e91430', clause_name: 'Acceptance Criteria Definition', category: 'dispute_resolution', ideal_position: 9, minimum_position: 7, maximum_position: 10, fallback_position: 8, importance_level: 9, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: '0d3e70fd', clause_name: 'Benchmarking Avoidance', category: 'dispute_resolution', ideal_position: 9, minimum_position: 5, maximum_position: 10, fallback_position: 6, importance_level: 7, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: '9cba4cac', clause_name: 'Change Control Procedure', category: 'dispute_resolution', ideal_position: 9, minimum_position: 7, maximum_position: 10, fallback_position: 8, importance_level: 9, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: 'a0ebeb4a', clause_name: 'Benchmarking Avoidance', category: 'employment', ideal_position: 9, minimum_position: 4, maximum_position: 10, fallback_position: 6, importance_level: 6, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: 'b52ffccb', clause_name: 'Contract Execution Requirement', category: 'employment', ideal_position: 10, minimum_position: 8, maximum_position: 10, fallback_position: 9, importance_level: 10, is_deal_breaker: true, is_non_negotiable: true },
    { rule_id: 'c43dac0b', clause_name: 'Delivery Location Freedom', category: 'employment', ideal_position: 8, minimum_position: 5, maximum_position: 10, fallback_position: 6, importance_level: 7, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: 'fe2b3683', clause_name: 'Contract Suspension Rights', category: 'exit_transition', ideal_position: 7, minimum_position: 4, maximum_position: 10, fallback_position: 6, importance_level: 5, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: '4a1d22a6', clause_name: 'Contract Termination for Cause by Client', category: 'exit_transition', ideal_position: 7, minimum_position: 4, maximum_position: 10, fallback_position: 6, importance_level: 9, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: 'ce75f474', clause_name: 'Other Termination Rights', category: 'exit_transition', ideal_position: 6, minimum_position: 3, maximum_position: 9, fallback_position: 5, importance_level: 6, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: '617a6e66', clause_name: 'Benchmarking Avoidance', category: 'governance', ideal_position: 9, minimum_position: 4, maximum_position: 10, fallback_position: 6, importance_level: 7, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: '81daa323', clause_name: 'Causation Defense', category: 'liability', ideal_position: 10, minimum_position: 7, maximum_position: 10, fallback_position: 8, importance_level: 9, is_deal_breaker: true, is_non_negotiable: true },
    { rule_id: 'c5ef3700', clause_name: 'Fee Calculation Exclusions', category: 'liability', ideal_position: 9, minimum_position: 7, maximum_position: 10, fallback_position: 8, importance_level: 7, is_deal_breaker: false, is_non_negotiable: true },
    { rule_id: '1db6c961', clause_name: 'General Liability Integration', category: 'liability', ideal_position: 9, minimum_position: 6, maximum_position: 10, fallback_position: 7, importance_level: 9, is_deal_breaker: false, is_non_negotiable: true },
    { rule_id: 'df4174fa', clause_name: 'Change Control Procedure Req.', category: 'scope', ideal_position: 9, minimum_position: 7, maximum_position: 10, fallback_position: 8, importance_level: 9, is_deal_breaker: false, is_non_negotiable: true },
    { rule_id: 'c493a2cf', clause_name: 'Clear Service Definition Req.', category: 'scope', ideal_position: 9, minimum_position: 7, maximum_position: 10, fallback_position: 8, importance_level: 10, is_deal_breaker: true, is_non_negotiable: true },
    { rule_id: '2311aa32', clause_name: 'Fee Calculation Exclusions', category: 'service_levels', ideal_position: 9, minimum_position: 7, maximum_position: 10, fallback_position: 8, importance_level: 6, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: '5247db39', clause_name: 'Historical Performance Evidence', category: 'service_levels', ideal_position: 9, minimum_position: 6, maximum_position: 10, fallback_position: 7, importance_level: 8, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: '81a1d04b', clause_name: 'Subcontractor Acceptance Process', category: 'subcontracting', ideal_position: 9, minimum_position: 6, maximum_position: 10, fallback_position: 7, importance_level: 8, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: '368c0ef6', clause_name: 'Subcontractor Change Control', category: 'subcontracting', ideal_position: 9, minimum_position: 6, maximum_position: 10, fallback_position: 7, importance_level: 8, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: '8ee408e1', clause_name: 'Subcontractor Flow-Down Req.', category: 'subcontracting', ideal_position: 9, minimum_position: 6, maximum_position: 10, fallback_position: 7, importance_level: 8, is_deal_breaker: false, is_non_negotiable: false },
    { rule_id: '7f99ae98', clause_name: 'Auto Termination After Benchmark', category: 'termination', ideal_position: 9, minimum_position: 7, maximum_position: 10, fallback_position: 8, importance_level: 8, is_deal_breaker: true, is_non_negotiable: true },
    { rule_id: '0476bbaf', clause_name: 'Capgemini Termination Right', category: 'termination', ideal_position: 9, minimum_position: 7, maximum_position: 10, fallback_position: 8, importance_level: 9, is_deal_breaker: true, is_non_negotiable: true },
    { rule_id: '472ecaa1', clause_name: 'Legal Review Requirement', category: 'insurance', ideal_position: 10, minimum_position: 10, maximum_position: 10, fallback_position: 10, importance_level: 10, is_deal_breaker: true, is_non_negotiable: true },
    { rule_id: '3d6cd267', clause_name: 'Causation Protection', category: 'insurance', ideal_position: 10, minimum_position: 7, maximum_position: 10, fallback_position: 8, importance_level: 9, is_deal_breaker: false, is_non_negotiable: false },
  ]

  const clauses = [
    { clause_number: '4.2', clause_name: 'Order Form process', category: 'scope_of_services' },
    { clause_number: '4.3', clause_name: 'Work Order process', category: 'scope_of_services' },
    { clause_number: '5.1', clause_name: 'Amending this Agreement', category: 'change_management' },
    { clause_number: '7.1', clause_name: 'Implementation Services', category: 'scope_of_services' },
    { clause_number: '7.3', clause_name: 'Service of Defects Notice', category: 'service_levels' },
    { clause_number: '9.2', clause_name: 'Standards of Performance', category: 'service_levels' },
    { clause_number: '10.1', clause_name: 'Service Levels and KPIs', category: 'service_levels' },
    { clause_number: '10.3', clause_name: 'Compliance with Laws', category: 'compliance_and_regulatory' },
    { clause_number: '10.5', clause_name: 'Good faith and cooperation', category: 'general_provisions' },
    { clause_number: '10.13', clause_name: 'Acceptance Process', category: 'service_levels' },
    { clause_number: '12.1', clause_name: 'Category B Changes', category: 'change_management' },
    { clause_number: '14', clause_name: 'Governance', category: 'governance' },
    { clause_number: '15.1', clause_name: 'Representatives', category: 'dispute_resolution' },
    { clause_number: '15.4', clause_name: 'Arbitration', category: 'dispute_resolution' },
    { clause_number: '16.1', clause_name: 'Inspection Rights', category: 'audit_rights' },
    { clause_number: '18.5', clause_name: 'Payment of invoices', category: 'payment_terms' },
    { clause_number: '18.9', clause_name: 'Benchmarking', category: 'payment_terms' },
    { clause_number: '19.1', clause_name: 'Supplier to insure', category: 'insurance' },
    { clause_number: '19.2', clause_name: 'Cover not to be prejudiced', category: 'insurance' },
    { clause_number: '20.1', clause_name: 'Supplier relief', category: 'force_majeure' },
    { clause_number: '21.2', clause_name: 'Company right to Suspend', category: 'termination' },
    { clause_number: '21.7', clause_name: 'Termination Right', category: 'termination' },
    { clause_number: '23.1', clause_name: 'Termination for insolvency', category: 'termination' },
    { clause_number: '23.3', clause_name: 'Termination for material breach', category: 'termination' },
    { clause_number: '23.5', clause_name: 'Termination on notice', category: 'termination' },
    { clause_number: '23.7', clause_name: 'Supplier termination non-payment', category: 'termination' },
    { clause_number: '27.1', clause_name: 'Mutual Representation & Warranty', category: 'representations' },
    { clause_number: '28.1', clause_name: 'Supplier indemnity', category: 'liability_and_indemnity' },
    { clause_number: '29.1', clause_name: 'Liability not excluded or limited', category: 'liability_and_indemnity' },
    { clause_number: '29.4', clause_name: 'Supplier aggregate liability', category: 'liability_and_indemnity' },
    { clause_number: '29.6', clause_name: 'Exclusion of consequential loss', category: 'liability_and_indemnity' },
    { clause_number: '30.2', clause_name: 'Newly-created IPR', category: 'intellectual_property' },
    { clause_number: '30.3', clause_name: 'Supplier IPR', category: 'intellectual_property' },
    { clause_number: '31.1', clause_name: 'Compliance with Act', category: 'data_protection' },
    { clause_number: '31.2', clause_name: 'Supplier as Data Processor', category: 'data_protection' },
    { clause_number: '33.1', clause_name: 'Duty to preserve confidentiality', category: 'confidentiality' },
    { clause_number: '35.1', clause_name: 'General Obligation', category: 'subcontracting' },
    { clause_number: '35.2', clause_name: 'Removal of Subcontractors', category: 'subcontracting' },
    { clause_number: '35.3', clause_name: 'No relief from obligations', category: 'subcontracting' },
    { clause_number: '47', clause_name: 'TUPE', category: 'general_provisions' },
  ]

  const seedMappings = [
    { rule_id: '5dceb8ba', clause_number: '31.1', confidence: 75, is_confirmed: false },
    { rule_id: '97cadb97', clause_number: '31.2', confidence: 50, is_confirmed: false },
    { rule_id: '69e91430', clause_number: '10.13', confidence: 100, is_confirmed: true },
    { rule_id: '81daa323', clause_number: '29.1', confidence: 75, is_confirmed: false },
    { rule_id: 'c5ef3700', clause_number: '29.4', confidence: 50, is_confirmed: false },
    { rule_id: '81a1d04b', clause_number: '35.1', confidence: 75, is_confirmed: true },
    { rule_id: '8ee408e1', clause_number: '35.3', confidence: 70, is_confirmed: true },
    { rule_id: 'fe2b3683', clause_number: '21.2', confidence: 100, is_confirmed: true },
    { rule_id: '4a1d22a6', clause_number: '23.3', confidence: 85, is_confirmed: false },
    { rule_id: '7f99ae98', clause_number: '21.7', confidence: 60, is_confirmed: false },
    { rule_id: '0d3e70fd', clause_number: '18.9', confidence: 90, is_confirmed: true },
    { rule_id: '5247db39', clause_number: '9.2', confidence: 65, is_confirmed: false },
    { rule_id: 'df4174fa', clause_number: '5.1', confidence: 70, is_confirmed: false },
    { rule_id: '472ecaa1', clause_number: '19.1', confidence: 50, is_confirmed: false },
  ]

  const catColors: Record<string, { bg: string; badge: string }> = {
    data_protection: { bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700' },
    dispute_resolution: { bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
    employment: { bg: 'bg-indigo-50', badge: 'bg-indigo-100 text-indigo-700' },
    exit_transition: { bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
    governance: { bg: 'bg-teal-50', badge: 'bg-teal-100 text-teal-700' },
    liability: { bg: 'bg-red-50', badge: 'bg-red-100 text-red-700' },
    scope: { bg: 'bg-green-50', badge: 'bg-green-100 text-green-700' },
    service_levels: { bg: 'bg-cyan-50', badge: 'bg-cyan-100 text-cyan-700' },
    subcontracting: { bg: 'bg-lime-50', badge: 'bg-lime-100 text-lime-700' },
    termination: { bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700' },
    insurance: { bg: 'bg-pink-50', badge: 'bg-pink-100 text-pink-700' },
    compliance_and_regulatory: { bg: 'bg-slate-50', badge: 'bg-slate-100 text-slate-700' },
    general_provisions: { bg: 'bg-stone-50', badge: 'bg-stone-100 text-stone-700' },
    change_management: { bg: 'bg-sky-50', badge: 'bg-sky-100 text-sky-700' },
    audit_rights: { bg: 'bg-violet-50', badge: 'bg-violet-100 text-violet-700' },
    payment_terms: { bg: 'bg-fuchsia-50', badge: 'bg-fuchsia-100 text-fuchsia-700' },
    representations: { bg: 'bg-rose-50', badge: 'bg-rose-100 text-rose-700' },
    liability_and_indemnity: { bg: 'bg-red-50', badge: 'bg-red-100 text-red-700' },
    intellectual_property: { bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' },
    confidentiality: { bg: 'bg-gray-50', badge: 'bg-gray-100 text-gray-700' },
    scope_of_services: { bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700' },
    force_majeure: { bg: 'bg-neutral-50', badge: 'bg-neutral-200 text-neutral-700' },
  }

  const getColor = (cat: string) => catColors[cat] || { bg: 'bg-slate-50', badge: 'bg-slate-100 text-slate-600' }

  const getLineColor = (confidence: number) => {
    if (confidence >= 80) return '#22c55e'
    if (confidence >= 60) return '#eab308'
    if (confidence >= 40) return '#ef4444'
    return '#1f2937'
  }

  // State
  const [mappings, setMappings] = useState(seedMappings)
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [hoveredMapping, setHoveredMapping] = useState<number | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const [svgPaths, setSvgPaths] = useState<Array<{ mapping: typeof seedMappings[0]; path: string }>>([])
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const ruleCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const clauseCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const leftColRef = useRef<HTMLDivElement>(null)
  const rightColRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const allCategories = useMemo(() => {
    const cats = new Set([...rules.map(r => r.category), ...clauses.map(c => c.category)])
    return Array.from(cats).sort()
  }, [])

  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      const matchesCat = selectedCategory === 'all' || rule.category === selectedCategory
      const matchesSearch = !searchQuery || rule.clause_name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCat && matchesSearch
    })
  }, [selectedCategory, searchQuery])

  const filteredClauses = useMemo(() => {
    return clauses.filter(clause => {
      const matchesCat = selectedCategory === 'all' || clause.category === selectedCategory
      const matchesSearch = !searchQuery ||
        clause.clause_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clause.clause_number.includes(searchQuery)
      return matchesCat && matchesSearch
    })
  }, [selectedCategory, searchQuery])

  const mappedRuleIds = useMemo(() => new Set(mappings.map(m => m.rule_id)), [mappings])
  const mappedClauseNumbers = useMemo(() => new Set(mappings.map(m => m.clause_number)), [mappings])
  const confirmedCount = useMemo(() => mappings.filter(m => m.is_confirmed).length, [mappings])

  // Recalculate SVG paths
  const updatePaths = useCallback(() => {
    if (!svgRef.current) return
    const svgRect = svgRef.current.getBoundingClientRect()
    const paths = mappings
      .map(mapping => {
        const ruleEl = ruleCardRefs.current[mapping.rule_id]
        const clauseEl = clauseCardRefs.current[mapping.clause_number]
        if (!ruleEl || !clauseEl) return null
        const rr = ruleEl.getBoundingClientRect()
        const cr = clauseEl.getBoundingClientRect()
        const x1 = rr.right - svgRect.left
        const y1 = rr.top - svgRect.top + rr.height / 2
        const x2 = cr.left - svgRect.left
        const y2 = cr.top - svgRect.top + cr.height / 2
        const cpX = (x2 - x1) * 0.4
        return { mapping, path: `M ${x1} ${y1} C ${x1 + cpX} ${y1}, ${x2 - cpX} ${y2}, ${x2} ${y2}` }
      })
      .filter(Boolean) as Array<{ mapping: typeof seedMappings[0]; path: string }>
    setSvgPaths(paths)
  }, [mappings])

  useEffect(() => {
    updatePaths()
    const timer = setTimeout(updatePaths, 100)
    const onScroll = () => updatePaths()
    leftColRef.current?.addEventListener('scroll', onScroll)
    rightColRef.current?.addEventListener('scroll', onScroll)
    window.addEventListener('resize', onScroll)
    return () => {
      clearTimeout(timer)
      leftColRef.current?.removeEventListener('scroll', onScroll)
      rightColRef.current?.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [updatePaths, filteredRules, filteredClauses])

  const handleRuleClick = (ruleId: string) => {
    setSelectedRuleId(prev => prev === ruleId ? null : ruleId)
  }

  const handleClauseClick = (clauseNumber: string) => {
    if (!selectedRuleId) return
    const existing = mappings.find(m => m.rule_id === selectedRuleId && m.clause_number === clauseNumber)
    if (existing) {
      setMappings(prev => prev.filter(m => !(m.rule_id === selectedRuleId && m.clause_number === clauseNumber)))
    } else {
      setMappings(prev => [...prev, { rule_id: selectedRuleId, clause_number: clauseNumber, confidence: 60, is_confirmed: false }])
    }
    setSelectedRuleId(null)
    setTimeout(updatePaths, 50)
  }

  const toPercent = (v: number) => ((v - 1) / 9) * 100

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-50 border-b border-slate-200 px-6 py-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mapping Workspace</h1>
            <p className="text-xs text-slate-500 mt-0.5">Connect playbook rules to template clauses — click a rule, then click a clause to link them</p>
          </div>
          <button
            onClick={() => { setMappings(seedMappings); setTimeout(updatePaths, 50) }}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Run Auto-Map
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-4">
          {[
            { label: 'Total Rules', value: rules.length, color: 'text-slate-900' },
            { label: 'Mapped', value: mappedRuleIds.size, color: 'text-indigo-600' },
            { label: 'Unmapped', value: rules.length - mappedRuleIds.size, color: 'text-slate-500' },
            { label: 'Confirmed', value: confirmedCount, color: 'text-emerald-600' },
            { label: 'Mappings', value: mappings.length, color: 'text-slate-900' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg px-4 py-2 border border-slate-200 flex-1">
              <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{s.label}</div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-xs">
            <div className="absolute left-3 top-1/2 -translate-y-1/2"><SearchIcon /></div>
            <input
              type="text"
              placeholder="Search rules or clauses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
            >
              All
            </button>
            {allCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                {cat.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content with SVG overlay */}
      <div className="flex-1 relative overflow-hidden">
        {/* SVG layer */}
        <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
          {svgPaths.map((p, idx) => (
            <g key={idx}>
              <path
                d={p.path}
                stroke="transparent"
                strokeWidth="14"
                fill="none"
                className="pointer-events-auto cursor-pointer"
                onMouseEnter={(e) => {
                  if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
                  setHoveredMapping(idx)
                  setHoverPos({ x: e.clientX, y: e.clientY })
                }}
                onMouseMove={(e) => {
                  setHoverPos({ x: e.clientX, y: e.clientY })
                }}
                onMouseLeave={() => {
                  hoverTimeout.current = setTimeout(() => {
                    setHoveredMapping(null)
                    setHoverPos(null)
                  }, 300)
                }}
              />
              <path
                d={p.path}
                stroke={getLineColor(p.mapping.confidence)}
                strokeWidth={hoveredMapping === idx ? 3 : 1.5}
                fill="none"
                strokeDasharray={p.mapping.is_confirmed ? '0' : '6,4'}
                opacity={hoveredMapping === null || hoveredMapping === idx ? 1 : 0.15}
                className="transition-opacity duration-200"
              />
              {/* Confidence label on hover */}
              {hoveredMapping === idx && (() => {
                const parts = p.path.split(' ')
                const mx = parseFloat(parts[1])
                const my = parseFloat(parts[2])
                const endX = parseFloat(parts[parts.length - 2])
                const endY = parseFloat(parts[parts.length - 1])
                const midX = (mx + endX) / 2
                const midY = (my + endY) / 2
                return (
                  <g>
                    <rect x={midX - 18} y={midY - 10} width="36" height="20" rx="4" fill="white" stroke={getLineColor(p.mapping.confidence)} strokeWidth="1" />
                    <text x={midX} y={midY + 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill={getLineColor(p.mapping.confidence)}>{p.mapping.confidence}%</text>
                  </g>
                )
              })()}
            </g>
          ))}
        </svg>

        <div className="flex h-full">
          {/* Left: Rules */}
          <div ref={leftColRef} className="w-[45%] overflow-y-auto p-4 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Playbook Rules ({filteredRules.length})</div>
            {filteredRules.map(rule => {
              const isMapped = mappedRuleIds.has(rule.rule_id)
              const isSelected = selectedRuleId === rule.rule_id
              const c = getColor(rule.category)
              return (
                <div
                  key={rule.rule_id}
                  ref={el => { ruleCardRefs.current[rule.rule_id] = el }}
                  onClick={() => handleRuleClick(rule.rule_id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50 scale-[1.02] shadow-md' :
                    isMapped ? `border-slate-200 ${c.bg} hover:shadow-sm` :
                    'border-dashed border-slate-300 bg-white opacity-60 hover:opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-xs font-semibold text-slate-800 leading-tight">{rule.clause_name}</h3>
                    <div className="flex gap-1 flex-shrink-0">
                      {rule.is_deal_breaker && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">DB</span>}
                      {rule.is_non_negotiable && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">NN</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${c.badge}`}>{rule.category.replace(/_/g, ' ')}</span>
                    {!isMapped && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">unmapped</span>}
                  </div>
                  {/* Mini position bar */}
                  <div className="relative h-3 bg-slate-100 rounded-full overflow-visible">
                    {/* Market range band */}
                    <div
                      className="absolute top-0.5 h-2 bg-amber-100 rounded-full border border-amber-200"
                      style={{ left: `${toPercent(rule.minimum_position)}%`, width: `${Math.max(1, toPercent(rule.maximum_position) - toPercent(rule.minimum_position))}%` }}
                    />
                    {/* Ideal marker */}
                    <div
                      className="absolute top-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm"
                      style={{ left: `${toPercent(rule.ideal_position)}%`, transform: 'translateX(-50%)' }}
                      title={`Ideal: ${rule.ideal_position}`}
                    />
                    {/* Fallback marker */}
                    <div
                      className="absolute top-0 w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm"
                      style={{ left: `${toPercent(rule.fallback_position)}%`, transform: 'translateX(-50%)' }}
                      title={`Fallback: ${rule.fallback_position}`}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] text-slate-400 mt-0.5 px-0.5">
                    <span>1</span>
                    <span>5</span>
                    <span>10</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Center gap for lines */}
          <div className="w-[10%] flex-shrink-0" />

          {/* Right: Clauses */}
          <div ref={rightColRef} className="w-[45%] overflow-y-auto p-4 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Template Clauses ({filteredClauses.length})</div>
            {filteredClauses.map(clause => {
              const isMapped = mappedClauseNumbers.has(clause.clause_number)
              const c = getColor(clause.category)
              return (
                <div
                  key={clause.clause_number}
                  ref={el => { clauseCardRefs.current[clause.clause_number] = el }}
                  onClick={() => handleClauseClick(clause.clause_number)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedRuleId ? 'hover:ring-2 hover:ring-indigo-500 hover:shadow-md' : ''
                  } ${
                    isMapped ? `border-slate-200 ${c.bg} hover:shadow-sm` :
                    'border-dashed border-slate-300 bg-white opacity-60 hover:opacity-80'
                  }`}
                >
                  <div className="flex items-start gap-2 mb-1.5">
                    <span className="inline-block bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0">
                      {clause.clause_number}
                    </span>
                    <h3 className="text-xs font-semibold text-slate-800 leading-tight">{clause.clause_name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${c.badge}`}>{clause.category.replace(/_/g, ' ')}</span>
                    {!isMapped && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">unmapped</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Floating popover on connector hover */}
      {hoveredMapping !== null && svgPaths[hoveredMapping] && hoverPos && (
        <div
          ref={popoverRef}
          onMouseEnter={() => { if (hoverTimeout.current) clearTimeout(hoverTimeout.current) }}
          onMouseLeave={() => {
            hoverTimeout.current = setTimeout(() => {
              setHoveredMapping(null)
              setHoverPos(null)
            }, 200)
          }}
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 min-w-[280px]"
          style={{
            left: Math.min(hoverPos.x + 12, window.innerWidth - 320),
            top: Math.max(8, Math.min(hoverPos.y - 60, window.innerHeight - 180)),
          }}
        >
          <div className="mb-2">
            <p className="text-xs font-semibold text-slate-900 leading-snug">
              {rules.find(r => r.rule_id === svgPaths[hoveredMapping].mapping.rule_id)?.clause_name}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-slate-400 text-[10px]">maps to</span>
              <span className="bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                {svgPaths[hoveredMapping].mapping.clause_number}
              </span>
              <span className="text-xs text-slate-700">
                {clauses.find(c => c.clause_number === svgPaths[hoveredMapping].mapping.clause_number)?.clause_name}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${svgPaths[hoveredMapping].mapping.confidence}%`,
                  backgroundColor: getLineColor(svgPaths[hoveredMapping].mapping.confidence),
                }}
              />
            </div>
            <span className="text-[10px] font-bold" style={{ color: getLineColor(svgPaths[hoveredMapping].mapping.confidence) }}>
              {svgPaths[hoveredMapping].mapping.confidence}%
            </span>
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
              svgPaths[hoveredMapping].mapping.is_confirmed
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {svgPaths[hoveredMapping].mapping.is_confirmed ? 'Confirmed' : 'Unconfirmed'}
            </span>
          </div>
          <div className="flex gap-1.5">
            {!svgPaths[hoveredMapping].mapping.is_confirmed && (
              <button
                onClick={() => {
                  const idx = mappings.indexOf(svgPaths[hoveredMapping].mapping)
                  if (idx >= 0) setMappings(prev => prev.map((m, i) => i === idx ? { ...m, is_confirmed: true } : m))
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors flex-1 justify-center"
              >
                <CheckIcon /> Confirm
              </button>
            )}
            <button
              onClick={() => {
                const idx = mappings.indexOf(svgPaths[hoveredMapping].mapping)
                if (idx >= 0) { setMappings(prev => prev.filter((_, i) => i !== idx)); setHoveredMapping(null); setHoverPos(null) }
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors flex-1 justify-center"
            >
              <XIcon /> Reject
            </button>
          </div>
        </div>
      )}

      {/* Selection hint */}
      {selectedRuleId && (
        <div className="flex-shrink-0 bg-indigo-600 text-white px-6 py-2 text-sm text-center">
          Rule selected: <strong>{rules.find(r => r.rule_id === selectedRuleId)?.clause_name}</strong> — now click a clause on the right to create a mapping, or click the rule again to deselect
        </div>
      )}
    </div>
  )
}
