// ============================================================================
// FILE: app/components/create-phase/YourRoleStep.tsx
// PURPOSE: Role selection step for the contract creation flow
// DEPLOY TO: /app/components/create-phase/YourRoleStep.tsx
// ============================================================================
// This component is inserted into the create-contract flow AFTER the
// contract type step. It shows the user the two party roles for their
// selected contract type and asks them to pick which one they are.
//
// Props:
//   contractTypeKey - The selected contract type key (e.g. 'service_agreement')
//   initiatorPartyRole - Current selection ('protected' | 'providing' | null)
//   onRoleSelect - Callback when user selects a role
// ============================================================================

'use client'

import { useState, useEffect } from 'react'
import {
    getContractType,
    getContractTypesByCategory,
    getRoleContext,
    type PartyRole,
    type ContractTypeDefinition,
} from '@/lib/role-matrix'


// ============================================================================
// SECTION 1: PROPS INTERFACE
// ============================================================================

interface YourRoleStepProps {
    contractTypeKey: string
    initiatorPartyRole: PartyRole | null
    onRoleSelect: (role: PartyRole) => void
}


// ============================================================================
// SECTION 2: MAIN COMPONENT
// ============================================================================

export default function YourRoleStep({
    contractTypeKey,
    initiatorPartyRole,
    onRoleSelect,
}: YourRoleStepProps) {
    const [contractType, setContractType] = useState<ContractTypeDefinition | null>(null)
    const [hoveredRole, setHoveredRole] = useState<PartyRole | null>(null)

    // Load contract type definition when key changes
    useEffect(() => {
        if (contractTypeKey) {
            const ct = getContractType(contractTypeKey)
            setContractType(ct || null)
        }
    }, [contractTypeKey])

    // If no contract type selected yet, show guidance
    if (!contractType) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-medium text-slate-800 mb-4">Your Role</h2>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                        Please select a contract type first. Your role options will appear here.
                    </p>
                </div>
            </div>
        )
    }

    // Derive preview context for the hovered/selected role
    const previewRole = hoveredRole || initiatorPartyRole
    const previewContext = previewRole
        ? getRoleContext(contractTypeKey, previewRole, true)
        : null

    return (
        <div className="space-y-6">

            {/* ============================================================ */}
            {/* SECTION 2A: HEADER */}
            {/* ============================================================ */}
            <div>
                <h2 className="text-2xl font-medium text-slate-800 mb-2">Your Role</h2>
                <p className="text-slate-500 text-sm">
                    A <span className="font-medium text-slate-700">{contractType.contractTypeName}</span> has
                    two parties. Which one are you?
                </p>
            </div>

            {/* ============================================================ */}
            {/* SECTION 2B: ROLE SELECTION CARDS */}
            {/* ============================================================ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Protected Party Card (e.g. Customer, Tenant, Buyer) */}
                <button
                    onClick={() => onRoleSelect('protected')}
                    onMouseEnter={() => setHoveredRole('protected')}
                    onMouseLeave={() => setHoveredRole(null)}
                    className={`relative text-left p-5 rounded-xl border-2 transition-all duration-200 ${initiatorPartyRole === 'protected'
                        ? 'border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-200'
                        : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'
                        }`}
                >
                    {/* Selected indicator */}
                    {initiatorPartyRole === 'protected' && (
                        <div className="absolute top-3 right-3 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    )}

                    {/* Role icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${initiatorPartyRole === 'protected' ? 'bg-emerald-200' : 'bg-emerald-100'
                        }`}>
                        <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>

                    {/* Role name */}
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">
                        {contractType.protectedPartyLabel}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-slate-500 mb-3">
                        {contractType.protectedPartyDescription}
                    </p>

                    {/* Position indicator */}
                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-100 rounded-md px-2.5 py-1.5 w-fit">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        Positions 7-10 favour you
                    </div>
                </button>

                {/* Providing Party Card (e.g. Provider, Landlord, Seller) */}
                <button
                    onClick={() => onRoleSelect('providing')}
                    onMouseEnter={() => setHoveredRole('providing')}
                    onMouseLeave={() => setHoveredRole(null)}
                    className={`relative text-left p-5 rounded-xl border-2 transition-all duration-200 ${initiatorPartyRole === 'providing'
                        ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                        }`}
                >
                    {/* Selected indicator */}
                    {initiatorPartyRole === 'providing' && (
                        <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    )}

                    {/* Role icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${initiatorPartyRole === 'providing' ? 'bg-blue-200' : 'bg-blue-100'
                        }`}>
                        <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>

                    {/* Role name */}
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">
                        {contractType.providingPartyLabel}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-slate-500 mb-3">
                        {contractType.providingPartyDescription}
                    </p>

                    {/* Position indicator */}
                    <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-100 rounded-md px-2.5 py-1.5 w-fit">
                        <svg className="w-3.5 h-3.5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        Positions 1-3 favour you
                    </div>
                </button>
            </div>

            {/* ============================================================ */}
            {/* SECTION 2C: POSITION SCALE PREVIEW */}
            {/* ============================================================ */}
            {previewContext && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                        Position Scale Preview
                    </p>

                    {/* You / Them labels */}
                    <div className="flex justify-between mb-1">
                        <span className={`text-xs font-semibold ${previewContext.positionFavorEnd === 1 ? 'text-blue-600' : 'text-slate-400'
                            }`}>
                            {previewContext.positionFavorEnd === 1 ? 'Favours You' : 'Favours Them'}
                        </span>
                        <span className={`text-xs font-semibold ${previewContext.positionFavorEnd === 10 ? 'text-emerald-600' : 'text-slate-400'
                            }`}>
                            {previewContext.positionFavorEnd === 10 ? 'Favours You' : 'Favours Them'}
                        </span>
                    </div>

                    {/* Scale bar */}
                    <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-blue-400 via-amber-300 to-emerald-400">
                        {/* Marker at position 5 (balanced) */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-white/60" />
                    </div>

                    {/* Scale numbers */}
                    <div className="flex justify-between mt-1 px-0.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                            <span key={n} className="text-[10px] text-slate-400 w-4 text-center">{n}</span>
                        ))}
                    </div>

                    {/* Role labels below */}
                    <div className="flex justify-between mt-2">
                        <span className="text-xs text-blue-600">
                            {previewContext.providingPartyLabel}-Favoring
                        </span>
                        <span className="text-xs text-slate-400">Balanced</span>
                        <span className="text-xs text-emerald-600">
                            {previewContext.protectedPartyLabel}-Favoring
                        </span>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* SECTION 2D: INFO BOX */}
            {/* ============================================================ */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="text-sm font-medium text-blue-800 mb-1">Why does this matter?</h4>
                        <p className="text-xs text-blue-700 leading-relaxed">
                            This helps CLARENCE show you the right perspective on the position scale.
                            The numbers (1-10) stay the same for both parties, but you will see
                            &ldquo;Favours You&rdquo; and &ldquo;Favours Them&rdquo; indicators so you always
                            know where you stand. CLARENCE remains neutral regardless of your role.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}


// ============================================================================
// SECTION 3: CONTRACT TYPE SELECTOR (ENHANCED)
// ============================================================================
// This is an enhanced version of the contract type dropdown that shows
// types grouped by category with descriptions. Can be used alongside
// or instead of the current contract type step.
// ============================================================================

interface ContractTypeSelectorProps {
    selectedKey: string
    onSelect: (key: string) => void
}

export function ContractTypeSelector({ selectedKey, onSelect }: ContractTypeSelectorProps) {
    const [isOpen, setIsOpen] = useState(false)
    const categories = getContractTypesByCategory()
    const selected = getContractType(selectedKey)

    const categoryOrder: Array<{ key: string; label: string }> = [
        { key: 'services', label: 'Services & Technology' },
        { key: 'confidentiality', label: 'Confidentiality' },
        { key: 'property_finance', label: 'Property & Finance' },
        { key: 'sales_distribution', label: 'Sales & Distribution' },
        { key: 'employment_construction', label: 'Employment & Construction' },
    ]

    return (
        <div className="relative">
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full text-left px-4 py-3 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-colors"
            >
                <div className="flex items-center justify-between">
                    <div>
                        {selected ? (
                            <>
                                <span className="font-medium text-slate-800">{selected.contractTypeName}</span>
                                <span className="text-xs text-slate-400 ml-2">
                                    ({selected.protectedPartyLabel} / {selected.providingPartyLabel})
                                </span>
                            </>
                        ) : (
                            <span className="text-slate-400">Select contract type...</span>
                        )}
                    </div>
                    <svg className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                    {categoryOrder.map(cat => {
                        const types = categories[cat.key]
                        if (!types || types.length === 0) return null
                        return (
                            <div key={cat.key}>
                                <div className="px-3 py-1.5 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide sticky top-0">
                                    {cat.label}
                                </div>
                                {types.map(ct => (
                                    <button
                                        key={ct.contractTypeKey}
                                        onClick={() => {
                                            onSelect(ct.contractTypeKey)
                                            setIsOpen(false)
                                        }}
                                        className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 ${selectedKey === ct.contractTypeKey ? 'bg-blue-50' : ''
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-sm text-slate-800">{ct.contractTypeName}</span>
                                            {selectedKey === ct.contractTypeKey && (
                                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-400">
                                            {ct.protectedPartyLabel} / {ct.providingPartyLabel}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// Re-export helpers for convenience
export { getContractType, getContractTypesByCategory, getCategoryDisplayName } from '@/lib/role-matrix'