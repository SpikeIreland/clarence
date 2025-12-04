'use client'

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { eventLogger } from '@/lib/eventLogger';

// ============================================================================
// SECTION 2: INTERFACES
// ============================================================================

interface ProviderCapabilities {
    // Company Information
    companyName: string
    companySize: string
    contactName: string
    contactEmail: string
    contactPhone: string
    yearsInBusiness: string
    annualRevenue: string
    website: string

    // Service Capabilities
    primaryServices: string[]
    secondaryServices: string[]
    industrySpecializations: string[]
    geographicCoverage: string[]
    languageCapabilities: string[]

    // Certifications & Compliance
    iso27001: boolean
    soc2TypeII: boolean
    gdprCompliant: boolean
    cyberEssentialsPlus: boolean
    otherCertifications: string[]

    // Commercial Profile
    dailyRateMin: number
    dailyRateMax: number
    minimumProjectValue: string
    preferredContractDuration: string
    paymentTerms: string
    pricingFlexibility: string

    // Contract Positions
    liabilityCap: number
    paymentTermsDays: number
    slaCommitment: number
    terminationNotice: number

    // Key Differentiators
    keyDifferentiators: string
    caseStudyReference: string

    // Provider Leverage Position
    marketPosition: string
    pipelineStrength: string
    alternativeClients: string
    strategicInterest: string
}

interface InviteData {
    bidId: string
    sessionId: string
    sessionNumber: string
    providerId: string
    customerCompany: string
    serviceRequired: string
    dealValue: string
    providerCompany: string
    providerContact: string
    providerEmail: string
    status: string
}

// ============================================================================
// SECTION 3: CONSTANTS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

const PRIMARY_SERVICE_OPTIONS = [
    'Back Office Operations',
    'Finance & Accounting',
    'Process Automation',
    'Customer Support',
    'Technical Support',
    'Data Processing',
    'IT Services',
    'HR Services'
]

const SECONDARY_SERVICE_OPTIONS = [
    'HR Administration',
    'Procurement Support',
    'Facilities Management',
    'Document Management',
    'Quality Assurance',
    'Training & Development',
    'Reporting & Analytics'
]

const INDUSTRY_OPTIONS = [
    'Financial Services',
    'Insurance',
    'Professional Services',
    'Healthcare',
    'Technology',
    'Retail',
    'Manufacturing',
    'Government'
]

const GEOGRAPHY_OPTIONS = [
    'UK',
    'Europe',
    'North America',
    'Asia Pacific',
    'Global'
]

const LANGUAGE_OPTIONS = [
    'English',
    'French',
    'German',
    'Spanish',
    'Portuguese',
    'Mandarin',
    'Hindi'
]

// ============================================================================
// SECTION 4: SHARED HEADER COMPONENT
// ============================================================================

function ProviderHeader({ email }: { email?: string }) {
    return (
        <header className="bg-slate-800 text-white">
            <div className="container mx-auto px-6">
                <nav className="flex justify-between items-center h-16">
                    {/* Logo & Brand - Blue gradient for Provider */}
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">C</span>
                        </div>
                        <div>
                            <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                            <div className="text-xs text-slate-400">Provider Intake</div>
                        </div>
                    </Link>

                    {/* Right: User email */}
                    <div className="flex items-center gap-4">
                        {email && (
                            <span className="text-sm text-slate-400">{email}</span>
                        )}
                    </div>
                </nav>
            </div>
        </header>
    )
}

// ============================================================================
// SECTION 5: SHARED FOOTER COMPONENT
// ============================================================================

function ProviderFooter() {
    return (
        <footer className="bg-slate-900 text-slate-400 py-8">
            <div className="container mx-auto px-6">
                <div className="flex flex-col md:flex-row justify-between items-center">
                    <div className="flex items-center gap-3 mb-4 md:mb-0">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">C</span>
                        </div>
                        <span className="text-white font-medium">CLARENCE</span>
                        <span className="text-slate-500 text-sm">Provider Portal</span>
                    </div>
                    <div className="text-sm">
                        © {new Date().getFullYear()} CLARENCE. The Honest Broker.
                    </div>
                </div>
            </div>
        </footer>
    )
}

// ============================================================================
// SECTION 6: MAIN COMPONENT WRAPPER (Suspense)
// ============================================================================

export default function ProviderIntakePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <ProviderHeader />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-10 h-10 border-3 border-slate-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-500">Loading provider portal...</p>
                    </div>
                </main>
                <ProviderFooter />
            </div>
        }>
            <ProviderIntakeContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 7: MAIN CONTENT COMPONENT
// ============================================================================

function ProviderIntakeContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // ========================================================================
    // SECTION 8: STATE
    // ========================================================================

    const [loading, setLoading] = useState(true)
    const [validating, setValidating] = useState(true)
    const [isValid, setIsValid] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [inviteData, setInviteData] = useState<InviteData | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [currentStep, setCurrentStep] = useState(1)
    const totalSteps = 6

    const [formData, setFormData] = useState<Partial<ProviderCapabilities>>({
        primaryServices: [],
        secondaryServices: [],
        industrySpecializations: [],
        geographicCoverage: [],
        languageCapabilities: [],
        otherCertifications: [],
        iso27001: false,
        soc2TypeII: false,
        gdprCompliant: false,
        cyberEssentialsPlus: false,
        dailyRateMin: 500,
        dailyRateMax: 1000,
        liabilityCap: 125,
        paymentTermsDays: 30,
        slaCommitment: 99.2,
        terminationNotice: 90
    })

    // ========================================================================
    // SECTION 9: SESSION VALIDATION (with localStorage fallback)
    // ========================================================================

    const validateSession = useCallback(async () => {
        // Get params from URL
        let sessionId = searchParams.get('session_id')
        let token = searchParams.get('token')
        let providerId = searchParams.get('provider_id')

        // Storage for registration data from localStorage
        let storedRegistrationData: {
            companyName?: string
            contactName?: string
            contactEmail?: string
            contactPhone?: string
            companySize?: string
            industry?: string
            sessionId?: string
            sessionNumber?: string
            providerId?: string
            token?: string
            customerCompany?: string
            serviceRequired?: string
            dealValue?: string
        } | null = null

        console.log('Intake validation - URL params:', { sessionId, token, providerId })

        // Try localStorage for missing params AND registration data
        try {
            // Check both localStorage keys for compatibility
            const storedSession = localStorage.getItem('clarence_provider_session') ||
                localStorage.getItem('providerSession')
            console.log('Intake validation - localStorage raw:', storedSession)

            if (storedSession) {
                storedRegistrationData = JSON.parse(storedSession)
                console.log('Intake validation - localStorage parsed:', storedRegistrationData)

                if (storedRegistrationData) {
                    if (!sessionId && storedRegistrationData.sessionId) {
                        sessionId = storedRegistrationData.sessionId
                    }
                    if (!token && storedRegistrationData.token) {
                        token = storedRegistrationData.token
                    }
                    if (!providerId && storedRegistrationData.providerId) {
                        providerId = storedRegistrationData.providerId
                    }
                }

                console.log('Intake validation - After localStorage merge:', { sessionId, token, providerId })
            }
        } catch (e) {
            console.error('Error reading localStorage:', e)
        }

        // Must have sessionId at minimum
        if (!sessionId) {
            console.log('Intake validation - FAILED: Missing session_id')
            setErrorMessage('Invalid session. Please check your email for the correct link.')
            setValidating(false)
            setLoading(false)
            return
        }

        // Helper function to pre-populate form with best available data
        const prePopulateForm = (apiData: Record<string, unknown> = {}) => {
            // Priority: API data > localStorage data > empty
            setFormData(prev => ({
                ...prev,
                // Company Info - prefer API, fallback to localStorage
                companyName: (apiData.providerCompany as string) ||
                    (apiData.provider_company as string) ||
                    storedRegistrationData?.companyName ||
                    prev.companyName || '',
                contactName: (apiData.providerContact as string) ||
                    (apiData.provider_contact_name as string) ||
                    storedRegistrationData?.contactName ||
                    prev.contactName || '',
                contactEmail: (apiData.providerEmail as string) ||
                    (apiData.provider_contact_email as string) ||
                    storedRegistrationData?.contactEmail ||
                    prev.contactEmail || '',
                contactPhone: storedRegistrationData?.contactPhone || prev.contactPhone || '',

                // These are ONLY from localStorage (not in API response)
                companySize: storedRegistrationData?.companySize || prev.companySize || '',

                // Map industry to industrySpecializations array if present
                industrySpecializations: storedRegistrationData?.industry
                    ? [storedRegistrationData.industry]
                    : prev.industrySpecializations || []
            }))
        }

        // STRATEGY: If we have providerId, use session-access validation (post-registration)
        // If we only have token, use invite validation (pre-registration)

        if (providerId) {
            // Provider is already registered - validate using session_id + provider_id
            console.log('Intake validation - Using provider_id validation:', { sessionId, providerId })

            try {
                const response = await fetch(`${API_BASE}/validate-provider-session-access?session_id=${sessionId}&provider_id=${providerId}`)

                console.log('Intake validation - API response status:', response.status)

                if (response.ok) {
                    const data = await response.json()
                    console.log('Intake validation - API response data:', data)

                    if (data.valid) {
                        setInviteData({
                            bidId: data.bidId || data.bid_id || '',
                            sessionId: data.sessionId || data.session_id || sessionId,
                            providerId: data.providerId || data.provider_id || providerId,
                            sessionNumber: data.sessionNumber || data.session_number || storedRegistrationData?.sessionNumber || '',
                            customerCompany: data.customerCompany || data.customer_company || storedRegistrationData?.customerCompany || '',
                            serviceRequired: data.serviceRequired || data.service_required || storedRegistrationData?.serviceRequired || '',
                            dealValue: data.dealValue || data.deal_value || storedRegistrationData?.dealValue || '',
                            providerCompany: data.providerCompany || data.provider_company || storedRegistrationData?.companyName || '',
                            providerContact: data.providerContact || data.provider_contact_name || storedRegistrationData?.contactName || '',
                            providerEmail: data.providerEmail || data.provider_contact_email || storedRegistrationData?.contactEmail || '',
                            status: data.status || data.bidStatus || 'registered'
                        })

                        // Pre-populate form with API + localStorage data
                        prePopulateForm(data)

                        // LOG: Intake form loaded via provider_id validation
                        eventLogger.setSession(data.sessionId || data.session_id || sessionId)
                        eventLogger.completed('provider_onboarding', 'provider_intake_form_loaded', {
                            sessionId: data.sessionId || data.session_id || sessionId,
                            providerId: data.providerId || data.provider_id || providerId,
                            source: 'provider_id_validation'
                        })

                        setIsValid(true)
                        console.log('Intake validation - SUCCESS: Valid session access')
                        setValidating(false)
                        setLoading(false)
                        return
                    }
                }
            } catch (error) {
                console.error('Session access validation error:', error)
            }
        }

        // Fallback: Try token-based validation (for pre-registration or if provider_id validation failed)
        if (token) {
            console.log('Intake validation - Falling back to token validation:', { sessionId, token })

            try {
                const response = await fetch(`${API_BASE}/validate-provider-invite?session_id=${sessionId}&token=${token}`)

                console.log('Intake validation - API response status:', response.status)

                if (response.ok) {
                    const data = await response.json()
                    console.log('Intake validation - API response data:', data)

                    if (data.valid) {
                        setInviteData({
                            bidId: data.bidId || data.bid_id || '',
                            sessionId: data.sessionId || data.session_id || sessionId,
                            providerId: data.providerId || data.provider_id || providerId || '',
                            sessionNumber: data.sessionNumber || data.session_number || storedRegistrationData?.sessionNumber || '',
                            customerCompany: data.customerCompany || data.customer_company || storedRegistrationData?.customerCompany || '',
                            serviceRequired: data.serviceRequired || data.service_required || storedRegistrationData?.serviceRequired || '',
                            dealValue: data.dealValue || data.deal_value || storedRegistrationData?.dealValue || '',
                            providerCompany: data.providerCompany || data.provider_company || storedRegistrationData?.companyName || '',
                            providerContact: data.providerContact || data.provider_contact_name || storedRegistrationData?.contactName || '',
                            providerEmail: data.providerEmail || data.provider_contact_email || storedRegistrationData?.contactEmail || '',
                            status: data.status || data.bidStatus || 'invited'
                        })

                        // Pre-populate form with API + localStorage data
                        prePopulateForm(data)

                        // LOG: Intake form loaded via token validation
                        eventLogger.setSession(data.sessionId || data.session_id || sessionId)
                        eventLogger.completed('provider_onboarding', 'provider_intake_form_loaded', {
                            sessionId: data.sessionId || data.session_id || sessionId,
                            providerId: data.providerId || data.provider_id || providerId,
                            source: 'token_validation'
                        })

                        setIsValid(true)
                        console.log('Intake validation - SUCCESS: Valid invite token')
                        setValidating(false)
                        setLoading(false)
                        return
                    } else {
                        console.log('Intake validation - FAILED: API said invalid -', data.message)
                    }
                }
            } catch (error) {
                console.error('Token validation error:', error)
            }
        }

        // Final fallback: Use localStorage data directly
        if (storedRegistrationData && storedRegistrationData.sessionId) {
            console.log('Intake validation - Using localStorage fallback')

            setInviteData({
                bidId: '',
                sessionId: sessionId,
                sessionNumber: storedRegistrationData.sessionNumber || '',
                providerId: storedRegistrationData.providerId || providerId || '',
                customerCompany: storedRegistrationData.customerCompany || '',
                serviceRequired: storedRegistrationData.serviceRequired || '',
                dealValue: storedRegistrationData.dealValue || '',
                providerCompany: storedRegistrationData.companyName || '',
                providerContact: storedRegistrationData.contactName || '',
                providerEmail: storedRegistrationData.contactEmail || '',
                status: 'registered'
            })

            // Pre-populate form from localStorage only
            prePopulateForm({})

            // LOG: Intake form loaded via localStorage fallback
            eventLogger.setSession(sessionId)
            eventLogger.completed('provider_onboarding', 'provider_intake_form_loaded', {
                sessionId: sessionId,
                providerId: storedRegistrationData.providerId || providerId,
                source: 'localStorage_fallback'
            })

            setIsValid(true)
            console.log('Intake validation - SUCCESS via localStorage fallback')
            setValidating(false)
            setLoading(false)
            return
        }

        // All validation methods failed
        // LOG: Validation failed
        eventLogger.failed('provider_onboarding', 'provider_intake_form_loaded', 'Unable to validate session', 'VALIDATION_FAILED')
        setErrorMessage('Unable to validate your session. Please return to your invitation link.')
        setValidating(false)
        setLoading(false)
    }, [searchParams])

    useEffect(() => {
        validateSession()
    }, [validateSession])

    // ========================================================================
    // SECTION 10: FORM HANDLERS
    // ========================================================================

    const updateFormData = (field: keyof ProviderCapabilities, value: unknown) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const toggleArrayItem = (field: keyof ProviderCapabilities, item: string) => {
        setFormData(prev => {
            const currentArray = (prev[field] as string[]) || []
            const newArray = currentArray.includes(item)
                ? currentArray.filter(i => i !== item)
                : [...currentArray, item]
            return { ...prev, [field]: newArray }
        })
    }

    // ========================================================================
    // SECTION 11: FORM SUBMISSION
    // ========================================================================

    const handleSubmit = async () => {
        if (!inviteData?.sessionId) return

        setSubmitting(true)

        // LOG: Form submission started
        eventLogger.started('provider_onboarding', 'provider_capabilities_submitted')

        try {
            const submissionData = {
                sessionId: inviteData.sessionId,
                sessionNumber: inviteData.sessionNumber,
                providerId: inviteData.providerId,
                bidId: inviteData.bidId,
                inviteToken: searchParams.get('token'),
                ...formData,
                submittedAt: new Date().toISOString(),
                formVersion: '3.0',
                formSource: 'provider-intake-v3'
            }

            const response = await fetch(`${API_BASE}/provider-capabilities-submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionData)
            })

            if (response.ok) {
                // LOG: Capabilities saved successfully
                eventLogger.completed('provider_onboarding', 'provider_capabilities_submitted', {
                    sessionId: inviteData.sessionId,
                    providerId: inviteData.providerId,
                    primaryServices: formData.primaryServices?.length || 0,
                    hasCertifications: !!(formData.iso27001 || formData.soc2TypeII || formData.gdprCompliant)
                })

                // LOG: Redirect to questionnaire
                eventLogger.completed('provider_onboarding', 'redirect_to_provider_questionnaire', {
                    sessionId: inviteData.sessionId,
                    providerId: inviteData.providerId
                })

                // Navigate to questionnaire
                router.push(`/provider/questionnaire?session_id=${inviteData.sessionId}&provider_id=${inviteData.providerId}`)
            } else {
                throw new Error('Submission failed')
            }
        } catch (error) {
            console.error('Submission error:', error)
            // LOG: Submission failed
            eventLogger.failed(
                'provider_onboarding',
                'provider_capabilities_submitted',
                error instanceof Error ? error.message : 'Submission failed',
                'SUBMISSION_ERROR'
            )
            alert('Failed to submit capabilities. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    // ========================================================================
    // SECTION 12: STEP NAVIGATION
    // ========================================================================

    const nextStep = () => {
        // LOG: Section completed
        eventLogger.completed('provider_onboarding', `provider_intake_section_${currentStep}_completed`, {
            sectionName: getStepName(currentStep),
            sessionId: inviteData?.sessionId,
            providerId: inviteData?.providerId
        })
        setCurrentStep(prev => Math.min(prev + 1, totalSteps))
    }

    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

    const getStepName = (step: number): string => {
        const names: Record<number, string> = {
            1: 'Company Information',
            2: 'Service Capabilities',
            3: 'Certifications & Compliance',
            4: 'Commercial Profile',
            5: 'Contract Positions',
            6: 'Review & Submit'
        }
        return names[step] || ''
    }

    // Scroll to top when step changes
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [currentStep])

    // ========================================================================
    // SECTION 13: LOADING STATE
    // ========================================================================

    if (loading || validating) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <ProviderHeader />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-500">Validating your invitation...</p>
                    </div>
                </main>
                <ProviderFooter />
            </div>
        )
    }

    // ========================================================================
    // SECTION 14: ERROR STATE
    // ========================================================================

    if (!isValid || errorMessage) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <ProviderHeader />
                <main className="flex-1 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-slate-800 mb-2">Invalid Invitation</h2>
                        <p className="text-slate-500 mb-6">{errorMessage || 'This invitation link is not valid or has expired.'}</p>
                        <Link
                            href="/provider"
                            className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                        >
                            Return to Provider Portal
                        </Link>
                    </div>
                </main>
                <ProviderFooter />
            </div>
        )
    }

    // ========================================================================
    // SECTION 15: MAIN RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <ProviderHeader email={formData.contactEmail} />

            {/* ================================================================ */}
            {/* SECTION 16: OPPORTUNITY BANNER */}
            {/* ================================================================ */}
            <div className="bg-blue-50 border-b border-blue-200 py-4">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-8">
                            <div>
                                <span className="text-blue-600 text-xs font-medium">Opportunity</span>
                                <div className="text-slate-800 font-medium">{inviteData?.serviceRequired || 'Service Contract'}</div>
                            </div>
                            <div>
                                <span className="text-blue-600 text-xs font-medium">Customer</span>
                                <div className="text-slate-800 font-medium">{inviteData?.customerCompany || '—'}</div>
                            </div>
                            <div>
                                <span className="text-blue-600 text-xs font-medium">Est. Value</span>
                                <div className="text-slate-800 font-medium">
                                    {inviteData?.dealValue ? `£${Number(inviteData.dealValue).toLocaleString()}` : '—'}
                                </div>
                            </div>
                        </div>
                        <div className="text-sm">
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full border border-blue-200 font-medium">
                                {inviteData?.sessionNumber || 'Session'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ================================================================ */}
            {/* SECTION 17: FORM CONTENT */}
            {/* ================================================================ */}
            <main className="flex-1 py-8">
                <div className="max-w-3xl mx-auto px-4">
                    {/* Progress Bar */}
                    <div className="mb-8">
                        <div className="flex justify-between mb-2">
                            <span className="text-sm text-slate-600">Step {currentStep} of {totalSteps}: {getStepName(currentStep)}</span>
                            <span className="text-sm text-slate-600">{Math.round((currentStep / totalSteps) * 100)}% Complete</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-4">
                            {[1, 2, 3, 4, 5, 6].map((step) => (
                                <button
                                    key={step}
                                    onClick={() => setCurrentStep(step)}
                                    className={`w-8 h-8 rounded-full text-xs font-medium transition-all cursor-pointer ${step === currentStep
                                        ? 'bg-blue-600 text-white'
                                        : step < currentStep
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-slate-200 text-slate-500'
                                        }`}
                                >
                                    {step < currentStep ? '✓' : step}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Form Steps */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                        {currentStep === 1 && (
                            <CompanyInfoStep formData={formData} updateFormData={updateFormData} />
                        )}
                        {currentStep === 2 && (
                            <ServiceCapabilitiesStep
                                formData={formData}
                                updateFormData={updateFormData}
                                toggleArrayItem={toggleArrayItem}
                            />
                        )}
                        {currentStep === 3 && (
                            <CertificationsStep formData={formData} updateFormData={updateFormData} />
                        )}
                        {currentStep === 4 && (
                            <CommercialProfileStep formData={formData} updateFormData={updateFormData} />
                        )}
                        {currentStep === 5 && (
                            <ContractPositionsStep formData={formData} updateFormData={updateFormData} />
                        )}
                        {currentStep === 6 && (
                            <ReviewStep formData={formData} inviteData={inviteData} />
                        )}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="mt-6 flex justify-between">
                        <button
                            onClick={prevStep}
                            disabled={currentStep === 1}
                            className={`px-6 py-2.5 rounded-lg transition-all cursor-pointer font-medium ${currentStep === 1
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                        >
                            ← Previous
                        </button>

                        {currentStep < totalSteps ? (
                            <button
                                onClick={nextStep}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all cursor-pointer font-medium"
                            >
                                Next →
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer font-medium"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Submitting...
                                    </>
                                ) : (
                                    <>Continue to Strategic Questions →</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </main>

            <ProviderFooter />
        </div>
    )
}

// ============================================================================
// SECTION 18: STEP COMPONENTS - INTERFACES
// ============================================================================

interface StepProps {
    formData: Partial<ProviderCapabilities>
    updateFormData: (field: keyof ProviderCapabilities, value: unknown) => void
}

interface ArrayStepProps extends StepProps {
    toggleArrayItem: (field: keyof ProviderCapabilities, item: string) => void
}

// ============================================================================
// SECTION 19: STEP 1 - Company Information
// ============================================================================

function CompanyInfoStep({ formData, updateFormData }: StepProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-1">Company Information</h2>
                <p className="text-slate-500 text-sm">Tell us about your organization</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder-slate-400"
                        value={formData.companyName || ''}
                        onChange={(e) => updateFormData('companyName', e.target.value)}
                        placeholder="Apex Customer Solutions"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Company Size <span className="text-red-500">*</span>
                    </label>
                    <select
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"
                        value={formData.companySize || ''}
                        onChange={(e) => updateFormData('companySize', e.target.value)}
                    >
                        <option value="">Select Size</option>
                        <option value="1-50">Small (1-50 employees)</option>
                        <option value="51-200">Medium (51-200 employees)</option>
                        <option value="201-500">Large (201-500 employees)</option>
                        <option value="501-1000">Enterprise (501-1000 employees)</option>
                        <option value="1000+">Corporation (1000+ employees)</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Contact Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder-slate-400"
                        value={formData.contactName || ''}
                        onChange={(e) => updateFormData('contactName', e.target.value)}
                        placeholder="Carl Lyons"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Contact Email <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="email"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder-slate-400"
                        value={formData.contactEmail || ''}
                        onChange={(e) => updateFormData('contactEmail', e.target.value)}
                        placeholder="carl@company.com"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Contact Phone</label>
                    <input
                        type="tel"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder-slate-400"
                        value={formData.contactPhone || ''}
                        onChange={(e) => updateFormData('contactPhone', e.target.value)}
                        placeholder="+44 20 7456 7890"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Years in Business</label>
                    <select
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"
                        value={formData.yearsInBusiness || ''}
                        onChange={(e) => updateFormData('yearsInBusiness', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="1-3">1-3 years</option>
                        <option value="4-7">4-7 years</option>
                        <option value="8-12">8-12 years</option>
                        <option value="13-20">13-20 years</option>
                        <option value="20+">20+ years</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Annual Revenue</label>
                    <select
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"
                        value={formData.annualRevenue || ''}
                        onChange={(e) => updateFormData('annualRevenue', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="Under £1M">Under £1M</option>
                        <option value="£1M-5M">£1M-5M</option>
                        <option value="£5M-10M">£5M-10M</option>
                        <option value="£10M-25M">£10M-25M</option>
                        <option value="£25M-50M">£25M-50M</option>
                        <option value="£50M+">£50M+</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Website</label>
                    <input
                        type="url"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder-slate-400"
                        placeholder="https://www.company.com"
                        value={formData.website || ''}
                        onChange={(e) => updateFormData('website', e.target.value)}
                    />
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 20: STEP 2 - Service Capabilities
// ============================================================================

function ServiceCapabilitiesStep({ formData, toggleArrayItem }: ArrayStepProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-1">Service Capabilities</h2>
                <p className="text-slate-500 text-sm">Select all services you can provide</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Primary Services <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {PRIMARY_SERVICE_OPTIONS.map(service => (
                        <label key={service} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition border border-slate-200">
                            <input
                                type="checkbox"
                                checked={(formData.primaryServices || []).includes(service)}
                                onChange={() => toggleArrayItem('primaryServices', service)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700">{service}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Secondary Services</label>
                <div className="grid grid-cols-2 gap-2">
                    {SECONDARY_SERVICE_OPTIONS.map(service => (
                        <label key={service} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition border border-slate-200">
                            <input
                                type="checkbox"
                                checked={(formData.secondaryServices || []).includes(service)}
                                onChange={() => toggleArrayItem('secondaryServices', service)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700">{service}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Industry Specializations</label>
                <div className="grid grid-cols-2 gap-2">
                    {INDUSTRY_OPTIONS.map(industry => (
                        <label key={industry} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition border border-slate-200">
                            <input
                                type="checkbox"
                                checked={(formData.industrySpecializations || []).includes(industry)}
                                onChange={() => toggleArrayItem('industrySpecializations', industry)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700">{industry}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Geographic Coverage</label>
                    <div className="space-y-2">
                        {GEOGRAPHY_OPTIONS.map(geo => (
                            <label key={geo} className="flex items-center gap-2 p-2 bg-slate-50 rounded cursor-pointer hover:bg-slate-100 transition">
                                <input
                                    type="checkbox"
                                    checked={(formData.geographicCoverage || []).includes(geo)}
                                    onChange={() => toggleArrayItem('geographicCoverage', geo)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700">{geo}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Language Capabilities</label>
                    <div className="space-y-2">
                        {LANGUAGE_OPTIONS.map(lang => (
                            <label key={lang} className="flex items-center gap-2 p-2 bg-slate-50 rounded cursor-pointer hover:bg-slate-100 transition">
                                <input
                                    type="checkbox"
                                    checked={(formData.languageCapabilities || []).includes(lang)}
                                    onChange={() => toggleArrayItem('languageCapabilities', lang)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700">{lang}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 21: STEP 3 - Certifications & Compliance
// ============================================================================

function CertificationsStep({ formData, updateFormData }: StepProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-1">Certifications & Compliance</h2>
                <p className="text-slate-500 text-sm">Select all certifications your organization holds</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition border border-slate-200">
                    <input
                        type="checkbox"
                        checked={formData.iso27001 || false}
                        onChange={(e) => updateFormData('iso27001', e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                    />
                    <div>
                        <span className="text-slate-800 font-medium">ISO 27001</span>
                        <p className="text-xs text-slate-500">Information Security Management</p>
                    </div>
                </label>

                <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition border border-slate-200">
                    <input
                        type="checkbox"
                        checked={formData.soc2TypeII || false}
                        onChange={(e) => updateFormData('soc2TypeII', e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                    />
                    <div>
                        <span className="text-slate-800 font-medium">SOC 2 Type II</span>
                        <p className="text-xs text-slate-500">Service Organization Control</p>
                    </div>
                </label>

                <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition border border-slate-200">
                    <input
                        type="checkbox"
                        checked={formData.gdprCompliant || false}
                        onChange={(e) => updateFormData('gdprCompliant', e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                    />
                    <div>
                        <span className="text-slate-800 font-medium">GDPR Compliant</span>
                        <p className="text-xs text-slate-500">Data Protection Regulation</p>
                    </div>
                </label>

                <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition border border-slate-200">
                    <input
                        type="checkbox"
                        checked={formData.cyberEssentialsPlus || false}
                        onChange={(e) => updateFormData('cyberEssentialsPlus', e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                    />
                    <div>
                        <span className="text-slate-800 font-medium">Cyber Essentials Plus</span>
                        <p className="text-xs text-slate-500">UK Government Cybersecurity</p>
                    </div>
                </label>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Key Differentiators</label>
                <textarea
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder-slate-400"
                    rows={4}
                    placeholder="12 years of proven excellence in back-office transformation with particular strength in financial services..."
                    value={formData.keyDifferentiators || ''}
                    onChange={(e) => updateFormData('keyDifferentiators', e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">Describe what makes your company stand out</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Case Study / Reference</label>
                <textarea
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder-slate-400"
                    rows={3}
                    placeholder="Successfully delivered a £2.1M back-office transformation for a mid-sized insurance company..."
                    value={formData.caseStudyReference || ''}
                    onChange={(e) => updateFormData('caseStudyReference', e.target.value)}
                />
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 22: STEP 4 - Commercial Profile
// ============================================================================

function CommercialProfileStep({ formData, updateFormData }: StepProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-1">Commercial Profile</h2>
                <p className="text-slate-500 text-sm">Define your commercial terms and pricing</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-700">
                    These terms help CLARENCE understand your commercial flexibility and find optimal terms for both parties.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Daily Rate Range: £{formData.dailyRateMin} - £{formData.dailyRateMax}
                </label>
                <div className="flex gap-4 items-center">
                    <div className="flex-1">
                        <input
                            type="range"
                            min="300"
                            max="1500"
                            step="50"
                            className="w-full accent-blue-600"
                            value={formData.dailyRateMin || 500}
                            onChange={(e) => updateFormData('dailyRateMin', parseInt(e.target.value))}
                        />
                        <div className="text-xs text-slate-500 text-center">Min: £{formData.dailyRateMin}</div>
                    </div>
                    <span className="text-slate-400">to</span>
                    <div className="flex-1">
                        <input
                            type="range"
                            min="300"
                            max="2000"
                            step="50"
                            className="w-full accent-blue-600"
                            value={formData.dailyRateMax || 1000}
                            onChange={(e) => updateFormData('dailyRateMax', parseInt(e.target.value))}
                        />
                        <div className="text-xs text-slate-500 text-center">Max: £{formData.dailyRateMax}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Minimum Project Value</label>
                    <select
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"
                        value={formData.minimumProjectValue || ''}
                        onChange={(e) => updateFormData('minimumProjectValue', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="No minimum">No Minimum</option>
                        <option value="£50,000">£50,000+</option>
                        <option value="£100,000">£100,000+</option>
                        <option value="£250,000">£250,000+</option>
                        <option value="£400,000">£400,000+</option>
                        <option value="£500,000">£500,000+</option>
                        <option value="£1,000,000">£1,000,000+</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Preferred Contract Duration</label>
                    <select
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"
                        value={formData.preferredContractDuration || ''}
                        onChange={(e) => updateFormData('preferredContractDuration', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="6-12 months">6-12 months</option>
                        <option value="12-24 months">12-24 months</option>
                        <option value="24-36 months">24-36 months</option>
                        <option value="24-48 months">24-48 months</option>
                        <option value="36-60 months">36-60 months</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Terms</label>
                    <select
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"
                        value={formData.paymentTerms || ''}
                        onChange={(e) => updateFormData('paymentTerms', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="NET 15">NET 15</option>
                        <option value="NET 30">NET 30 (preferred)</option>
                        <option value="NET 45">NET 45</option>
                        <option value="NET 60">NET 60</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Pricing Flexibility</label>
                    <select
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"
                        value={formData.pricingFlexibility || ''}
                        onChange={(e) => updateFormData('pricingFlexibility', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="Fixed (0-5%)">Fixed (0-5%)</option>
                        <option value="Moderate (8-12%)">Moderate (8-12%)</option>
                        <option value="Flexible (15-20%)">Flexible (15-20%)</option>
                        <option value="Highly Flexible (20%+)">Highly Flexible (20%+)</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Provider Leverage Position</label>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Market Position</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 text-sm"
                            value={formData.marketPosition || ''}
                            onChange={(e) => updateFormData('marketPosition', e.target.value)}
                        >
                            <option value="">Select</option>
                            <option value="Emerging - building reputation">Emerging</option>
                            <option value="Established - solid reputation">Established</option>
                            <option value="Leader - market leader">Market Leader</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Pipeline Strength</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 text-sm"
                            value={formData.pipelineStrength || ''}
                            onChange={(e) => updateFormData('pipelineStrength', e.target.value)}
                        >
                            <option value="">Select</option>
                            <option value="Light - few opportunities">Light</option>
                            <option value="Healthy - multiple active opportunities">Healthy</option>
                            <option value="Strong - oversubscribed">Strong</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Alternative Clients</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 text-sm"
                            value={formData.alternativeClients || ''}
                            onChange={(e) => updateFormData('alternativeClients', e.target.value)}
                        >
                            <option value="">Select</option>
                            <option value="Limited prospects">Limited</option>
                            <option value="Several qualified prospects">Several</option>
                            <option value="Many qualified prospects">Many</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Strategic Interest</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 text-sm"
                            value={formData.strategicInterest || ''}
                            onChange={(e) => updateFormData('strategicInterest', e.target.value)}
                        >
                            <option value="">Select</option>
                            <option value="Low - standard opportunity">Low</option>
                            <option value="Medium - good fit">Medium</option>
                            <option value="High - strategic priority">High</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 23: STEP 5 - Contract Positions
// ============================================================================

function ContractPositionsStep({ formData, updateFormData }: StepProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-1">Contract Positions</h2>
                <p className="text-slate-500 text-sm">Set your starting positions on key contract terms</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-700">
                    These positions will be used as your starting point in negotiations. CLARENCE will help find optimal compromises.
                </p>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Liability Cap: {formData.liabilityCap}% of annual fees
                    </label>
                    <input
                        type="range"
                        min="50"
                        max="300"
                        step="25"
                        className="w-full accent-blue-600"
                        value={formData.liabilityCap || 125}
                        onChange={(e) => updateFormData('liabilityCap', parseInt(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>50%</span>
                        <span>100%</span>
                        <span>150%</span>
                        <span>200%</span>
                        <span>250%</span>
                        <span>300%</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Payment Terms: {formData.paymentTermsDays} days
                    </label>
                    <input
                        type="range"
                        min="15"
                        max="60"
                        step="15"
                        className="w-full accent-blue-600"
                        value={formData.paymentTermsDays || 30}
                        onChange={(e) => updateFormData('paymentTermsDays', parseInt(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>NET 15</span>
                        <span>NET 30</span>
                        <span>NET 45</span>
                        <span>NET 60</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        SLA Commitment: {formData.slaCommitment}% uptime
                    </label>
                    <input
                        type="range"
                        min="98"
                        max="99.9"
                        step="0.1"
                        className="w-full accent-blue-600"
                        value={formData.slaCommitment || 99.2}
                        onChange={(e) => updateFormData('slaCommitment', parseFloat(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>98%</span>
                        <span>99%</span>
                        <span>99.5%</span>
                        <span>99.9%</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Termination Notice: {formData.terminationNotice} days
                    </label>
                    <input
                        type="range"
                        min="30"
                        max="180"
                        step="30"
                        className="w-full accent-blue-600"
                        value={formData.terminationNotice || 90}
                        onChange={(e) => updateFormData('terminationNotice', parseInt(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>30 days</span>
                        <span>60 days</span>
                        <span>90 days</span>
                        <span>120 days</span>
                        <span>150 days</span>
                        <span>180 days</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 24: STEP 6 - Review & Submit
// ============================================================================

function ReviewStep({ formData, inviteData }: { formData: Partial<ProviderCapabilities>, inviteData: InviteData | null }) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-1">Review Your Submission</h2>
                <p className="text-slate-500 text-sm">Please review your information before continuing</p>
            </div>

            <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="font-medium text-blue-600 mb-2 text-sm uppercase tracking-wide">Company</h3>
                    <p className="text-slate-800 font-medium">{formData.companyName}</p>
                    <p className="text-sm text-slate-500">{formData.contactName} • {formData.contactEmail}</p>
                    <p className="text-sm text-slate-500">{formData.companySize} • {formData.yearsInBusiness} years • {formData.annualRevenue}</p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="font-medium text-blue-600 mb-2 text-sm uppercase tracking-wide">Services</h3>
                    <p className="text-slate-800">{(formData.primaryServices || []).join(', ') || 'Not specified'}</p>
                    <p className="text-sm text-slate-500">
                        Industries: {(formData.industrySpecializations || []).join(', ') || 'Not specified'}
                    </p>
                    <p className="text-sm text-slate-500">
                        Coverage: {(formData.geographicCoverage || []).join(', ') || 'Not specified'}
                    </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="font-medium text-blue-600 mb-2 text-sm uppercase tracking-wide">Commercial</h3>
                    <p className="text-slate-800">£{formData.dailyRateMin} - £{formData.dailyRateMax} / day</p>
                    <p className="text-sm text-slate-500">
                        Min Project: {formData.minimumProjectValue} • Duration: {formData.preferredContractDuration}
                    </p>
                    <p className="text-sm text-slate-500">
                        Payment: {formData.paymentTerms} • Flexibility: {formData.pricingFlexibility}
                    </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="font-medium text-blue-600 mb-2 text-sm uppercase tracking-wide">Contract Positions</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <p className="text-slate-500">Liability Cap: <span className="text-slate-800 font-medium">{formData.liabilityCap}%</span></p>
                        <p className="text-slate-500">Payment Terms: <span className="text-slate-800 font-medium">{formData.paymentTermsDays} days</span></p>
                        <p className="text-slate-500">SLA: <span className="text-slate-800 font-medium">{formData.slaCommitment}%</span></p>
                        <p className="text-slate-500">Termination: <span className="text-slate-800 font-medium">{formData.terminationNotice} days</span></p>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="font-medium text-blue-600 mb-2 text-sm uppercase tracking-wide">Certifications</h3>
                    <div className="flex flex-wrap gap-2">
                        {formData.iso27001 && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">ISO 27001</span>}
                        {formData.soc2TypeII && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">SOC 2 Type II</span>}
                        {formData.gdprCompliant && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">GDPR</span>}
                        {formData.cyberEssentialsPlus && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">Cyber Essentials+</span>}
                        {!formData.iso27001 && !formData.soc2TypeII && !formData.gdprCompliant && !formData.cyberEssentialsPlus && (
                            <span className="text-slate-500 text-sm">None selected</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-medium text-amber-700 mb-2">What Happens Next?</h3>
                <ul className="text-sm text-amber-600 space-y-1">
                    <li>• CLARENCE will ask you strategic questions about this opportunity</li>
                    <li>• Your responses help calculate accurate leverage positions</li>
                    <li>• Once complete, you&apos;ll access the Contract Studio to negotiate with {inviteData?.customerCompany || 'the customer'}</li>
                </ul>
            </div>
        </div>
    )
}