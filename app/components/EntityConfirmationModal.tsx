'use client'

// ============================================================================
// ENTITY CONFIRMATION MODAL
// Location: app/components/EntityConfirmationModal.tsx
//
// Step 1 of the signing ceremony. Each party confirms their legal entity
// details and signatory information before signing can begin.
// Pre-populates from known company/user data but allows editing.
// ============================================================================

import { useState } from 'react'
import {
    type EntityConfirmationFormData,
    JURISDICTION_OPTIONS,
    isValidEmail,
} from '@/lib/signing'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

interface EntityConfirmationModalProps {
    show: boolean
    onClose: () => void
    onConfirm: (formData: EntityConfirmationFormData) => Promise<void>
    initialData: EntityConfirmationFormData
    partyRole: 'initiator' | 'respondent'
    isSubmitting: boolean
}

// ============================================================================
// SECTION 2: COMPONENT
// ============================================================================

export default function EntityConfirmationModal({
    show,
    onClose,
    onConfirm,
    initialData,
    partyRole,
    isSubmitting,
}: EntityConfirmationModalProps) {
    const [formData, setFormData] = useState<EntityConfirmationFormData>(initialData)
    const [errors, setErrors] = useState<Partial<Record<keyof EntityConfirmationFormData, string>>>({})

    if (!show) return null

    const accentColor = partyRole === 'initiator' ? 'emerald' : 'blue'
    const roleLabel = partyRole === 'initiator' ? 'Initiator' : 'Respondent'

    const updateField = (field: keyof EntityConfirmationFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        // Clear error on change
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }))
        }
    }

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof EntityConfirmationFormData, string>> = {}

        if (!formData.entityName.trim()) {
            newErrors.entityName = 'Legal entity name is required'
        }
        if (!formData.signatoryName.trim()) {
            newErrors.signatoryName = 'Signatory name is required'
        }
        if (!formData.signatoryTitle.trim()) {
            newErrors.signatoryTitle = 'Signatory title is required'
        }
        if (!formData.signatoryEmail.trim()) {
            newErrors.signatoryEmail = 'Signatory email is required'
        } else if (!isValidEmail(formData.signatoryEmail)) {
            newErrors.signatoryEmail = 'Please enter a valid email address'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async () => {
        if (!validate()) return
        await onConfirm(formData)
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className={`p-6 border-b border-slate-200 rounded-t-2xl ${
                    accentColor === 'emerald'
                        ? 'bg-gradient-to-r from-emerald-50 to-teal-50'
                        : 'bg-gradient-to-r from-blue-50 to-indigo-50'
                }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            accentColor === 'emerald' ? 'bg-emerald-100' : 'bg-blue-100'
                        }`}>
                            <svg className={`w-6 h-6 ${
                                accentColor === 'emerald' ? 'text-emerald-600' : 'text-blue-600'
                            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">
                                Entity Confirmation
                            </h2>
                            <p className="text-sm text-slate-500">
                                Confirm your legal entity details ({roleLabel})
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* Info Notice */}
                    <div className={`rounded-lg p-3 text-sm ${
                        accentColor === 'emerald'
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                            : 'bg-blue-50 border border-blue-200 text-blue-800'
                    }`}>
                        <p>
                            Please confirm the legal entity that will be party to this contract
                            and the authorised signatory. This information will appear on the
                            signing certificate.
                        </p>
                    </div>

                    {/* Entity Name */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Legal Entity Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.entityName}
                            onChange={(e) => updateField('entityName', e.target.value)}
                            placeholder="e.g. Clarence Legal Limited"
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                                errors.entityName
                                    ? 'border-red-300 focus:ring-red-500'
                                    : 'border-slate-200 focus:ring-violet-500'
                            }`}
                        />
                        {errors.entityName && (
                            <p className="text-xs text-red-500 mt-1">{errors.entityName}</p>
                        )}
                    </div>

                    {/* Registration Number */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Company Registration Number
                            <span className="text-slate-400 font-normal ml-1">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={formData.registrationNumber}
                            onChange={(e) => updateField('registrationNumber', e.target.value)}
                            placeholder="e.g. 16983899"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>

                    {/* Jurisdiction */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Registered Jurisdiction
                            <span className="text-slate-400 font-normal ml-1">(optional)</span>
                        </label>
                        <select
                            value={formData.jurisdiction}
                            onChange={(e) => updateField('jurisdiction', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                        >
                            <option value="">Select jurisdiction...</option>
                            {JURISDICTION_OPTIONS.map(j => (
                                <option key={j} value={j}>{j}</option>
                            ))}
                        </select>
                    </div>

                    {/* Registered Address */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Registered Address
                            <span className="text-slate-400 font-normal ml-1">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={formData.registeredAddress}
                            onChange={(e) => updateField('registeredAddress', e.target.value)}
                            placeholder="e.g. 123 Contract Lane, London, EC1A 1BB"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-200 pt-4">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">
                            Authorised Signatory
                        </h3>
                    </div>

                    {/* Signatory Name */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.signatoryName}
                            onChange={(e) => updateField('signatoryName', e.target.value)}
                            placeholder="e.g. Paul Smith"
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                                errors.signatoryName
                                    ? 'border-red-300 focus:ring-red-500'
                                    : 'border-slate-200 focus:ring-violet-500'
                            }`}
                        />
                        {errors.signatoryName && (
                            <p className="text-xs text-red-500 mt-1">{errors.signatoryName}</p>
                        )}
                    </div>

                    {/* Signatory Title */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Title / Role <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.signatoryTitle}
                            onChange={(e) => updateField('signatoryTitle', e.target.value)}
                            placeholder="e.g. Legal Director, Head of Procurement"
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                                errors.signatoryTitle
                                    ? 'border-red-300 focus:ring-red-500'
                                    : 'border-slate-200 focus:ring-violet-500'
                            }`}
                        />
                        {errors.signatoryTitle && (
                            <p className="text-xs text-red-500 mt-1">{errors.signatoryTitle}</p>
                        )}
                    </div>

                    {/* Signatory Email */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Email <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            value={formData.signatoryEmail}
                            onChange={(e) => updateField('signatoryEmail', e.target.value)}
                            placeholder="e.g. paul.smith@example.com"
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                                errors.signatoryEmail
                                    ? 'border-red-300 focus:ring-red-500'
                                    : 'border-slate-200 focus:ring-violet-500'
                            }`}
                        />
                        {errors.signatoryEmail && (
                            <p className="text-xs text-red-500 mt-1">{errors.signatoryEmail}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                            The signatory will receive a signing notification at this address.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="h-9 px-4 text-slate-600 hover:bg-slate-100 text-xs font-medium rounded-full transition"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className={`h-9 px-6 text-white text-xs font-medium rounded-full transition flex items-center gap-2 ${
                            accentColor === 'emerald'
                                ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300'
                                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300'
                        }`}
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Confirming...
                            </>
                        ) : (
                            <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Confirm Entity Details
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
