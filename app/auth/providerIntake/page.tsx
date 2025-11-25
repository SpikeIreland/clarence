'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================
interface ProviderCapabilities {
    // Company Info
    companyName: string
    contactName: string
    contactEmail: string
    companySize: string
    yearsInBusiness: string
    website: string

    // Service Capabilities
    serviceSpecialization: string
    secondaryServices: string[]
    industryExpertise: string[]
    geographicCoverage: string[]

    // Capacity & Resources
    availableCapacity: string
    teamSize: string
    rampUpTime: string
    currentUtilization: string

    // Commercial Terms
    pricingModel: string
    rateRangeMin: number
    rateRangeMax: number
    minimumContractValue: string
    preferredDuration: string
    paymentTermsAccepted: string

    // SLA Capabilities
    responseTimeCapability: string
    availabilityGuarantee: string
    satisfactionTarget: string

    // Compliance & Security
    certifications: string[]
    dataSecurityLevel: string
    gdprCompliant: boolean
    insuranceCoverage: string

    // Contract Flexibility
    liabilityCapAcceptable: string
    terminationNoticeAcceptable: string
    exclusivityWillingness: string
    customSlaWillingness: string

    // Differentiators
    keyDifferentiators: string
    referencesAvailable: boolean
    caseStudiesAvailable: boolean
}

interface InviteData {
    bidId: string
    sessionId: string
    sessionNumber: string
    customerCompany: string
    serviceRequired: string
    dealValue: string
    providerCompany: string
    providerContact: string
    providerEmail: string
    status: string
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================
const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

const SERVICE_OPTIONS = [
    'Customer Support',
    'Technical Support',
    'Data Processing',
    'IT Services',
    'Finance & Accounting',
    'HR Services',
    'Back Office Operations',
    'Sales Support'
]

const INDUSTRY_OPTIONS = [
    'Financial Services',
    'Healthcare',
    'Technology',
    'Retail',
    'Manufacturing',
    'Telecommunications',
    'Energy',
    'Government'
]

const CERTIFICATION_OPTIONS = [
    'ISO 27001',
    'ISO 9001',
    'SOC 2 Type II',
    'PCI DSS',
    'HIPAA',
    'GDPR Certified',
    'Cyber Essentials Plus'
]

const GEOGRAPHY_OPTIONS = [
    'UK',
    'Europe',
    'North America',
    'Asia Pacific',
    'Middle East',
    'Global'
]

// ============================================================================
// SECTION 3: MAIN COMPONENT WRAPPER (Suspense)
// ============================================================================
export default function ProviderIntakePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-slate-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading provider portal...</p>
                </div>
            </div>
        }>
            <ProviderIntakeContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 4: MAIN CONTENT COMPONENT
// ============================================================================
function ProviderIntakeContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // ========================================================================
    // SECTION 5: STATE
    // ========================================================================
    const [loading, setLoading] = useState(true)
    const [validating, setValidating] = useState(true)
    const [isValid, setIsValid] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [inviteData, setInviteData] = useState<InviteData | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [currentStep, setCurrentStep] = useState(1)
    const totalSteps = 5

    const [formData, setFormData] = useState<Partial<ProviderCapabilities>>({
        secondaryServices: [],
        industryExpertise: [],
        geographicCoverage: [],
        certifications: [],
        gdprCompliant: false,
        referencesAvailable: false,
        caseStudiesAvailable: false,
        rateRangeMin: 25,
        rateRangeMax: 75
    })

    // ========================================================================
    // SECTION 6: TOKEN VALIDATION
    // ========================================================================
    const validateToken = useCallback(async () => {
        const sessionId = searchParams.get('session_id')
        const token = searchParams.get('token')

        if (!sessionId || !token) {
            setErrorMessage('Invalid invitation link. Please check your email for the correct link.')
            setValidating(false)
            setLoading(false)
            return
        }

        try {
            const response = await fetch(`${API_BASE}/validate-provider-invite?session_id=${sessionId}&token=${token}`)

            if (response.ok) {
                const data = await response.json()

                if (data.valid) {
                    setInviteData({
                        bidId: data.bidId || data.bid_id,
                        sessionId: data.sessionId || data.session_id || sessionId,
                        sessionNumber: data.sessionNumber || data.session_number || '',
                        customerCompany: data.customerCompany || data.customer_company || '',
                        serviceRequired: data.serviceRequired || data.service_required || '',
                        dealValue: data.dealValue || data.deal_value || '',
                        providerCompany: data.providerCompany || data.provider_company || '',
                        providerContact: data.providerContact || data.provider_contact || '',
                        providerEmail: data.providerEmail || data.provider_email || '',
                        status: data.status || 'invited'
                    })

                    // Pre-populate form with invite data
                    setFormData(prev => ({
                        ...prev,
                        companyName: data.providerCompany || data.provider_company || '',
                        contactName: data.providerContact || data.provider_contact || '',
                        contactEmail: data.providerEmail || data.provider_email || ''
                    }))

                    setIsValid(true)
                } else {
                    setErrorMessage(data.message || 'This invitation is no longer valid.')
                }
            } else {
                // If validation endpoint doesn't exist, proceed with basic validation
                console.log('Validation endpoint not available, proceeding with token')
                setInviteData({
                    bidId: '',
                    sessionId: sessionId,
                    sessionNumber: '',
                    customerCompany: '',
                    serviceRequired: '',
                    dealValue: '',
                    providerCompany: '',
                    providerContact: '',
                    providerEmail: '',
                    status: 'invited'
                })
                setIsValid(true)
            }
        } catch (error) {
            console.error('Validation error:', error)
            // Proceed anyway for demo purposes
            setInviteData({
                bidId: '',
                sessionId: sessionId || '',
                sessionNumber: '',
                customerCompany: '',
                serviceRequired: '',
                dealValue: '',
                providerCompany: '',
                providerContact: '',
                providerEmail: '',
                status: 'invited'
            })
            setIsValid(true)
        }

        setValidating(false)
        setLoading(false)
    }, [searchParams])

    useEffect(() => {
        validateToken()
    }, [validateToken])

    // ========================================================================
    // SECTION 7: FORM HANDLERS
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
    // SECTION 8: FORM SUBMISSION
    // ========================================================================
    const handleSubmit = async () => {
        if (!inviteData?.sessionId) return

        setSubmitting(true)

        try {
            const submissionData = {
                // Invite context
                sessionId: inviteData.sessionId,
                sessionNumber: inviteData.sessionNumber,
                bidId: inviteData.bidId,
                inviteToken: searchParams.get('token'),

                // Provider capabilities
                ...formData,

                // Metadata
                submittedAt: new Date().toISOString(),
                formVersion: '2.0',
                formSource: 'provider-intake-invited'
            }

            const response = await fetch(`${API_BASE}/provider-capabilities-submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionData)
            })

            if (response.ok) {
                const result = await response.json()
                console.log('Submission successful:', result)
                router.push(`/auth/provider-confirmation?session_id=${inviteData.sessionId}`)
            } else {
                throw new Error('Submission failed')
            }
        } catch (error) {
            console.error('Submission error:', error)
            alert('Failed to submit capabilities. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    // ========================================================================
    // SECTION 9: STEP NAVIGATION
    // ========================================================================
    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, totalSteps))
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

    const getStepName = (step: number): string => {
        const names: Record<number, string> = {
            1: 'Company Information',
            2: 'Service Capabilities',
            3: 'Commercial Terms',
            4: 'Compliance & Security',
            5: 'Review & Submit'
        }
        return names[step] || ''
    }

    // ========================================================================
    // SECTION 10: LOADING/ERROR STATES
    // ========================================================================
    if (loading || validating) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-slate-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Validating your invitation...</p>
                </div>
            </div>
        )
    }

    if (!isValid || errorMessage) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-xl font-medium text-slate-800 mb-2">Invalid Invitation</h2>
                    <p className="text-slate-600 mb-6">{errorMessage || 'This invitation link is not valid or has expired.'}</p>
                    <Link
                        href="/"
                        className="inline-block px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
                    >
                        Return Home
                    </Link>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 11: MAIN RENDER
    // ========================================================================
    return (
        <div className="min-h-screen bg-slate-50">
            {/* ================================================================ */}
            {/* SECTION 12: NAVIGATION */}
            {/* ================================================================ */}
            <nav className="bg-white shadow-sm border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <div>
                                <div className="text-2xl font-medium text-slate-700">CLARENCE</div>
                                <div className="text-xs text-slate-500 tracking-widest font-light">THE HONEST BROKER</div>
                            </div>
                            <span className="ml-4 text-emerald-600 text-sm font-medium">Provider Portal</span>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Opportunity Banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-4">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div>
                                <span className="text-emerald-200 text-xs">Opportunity</span>
                                <div className="font-medium">{inviteData?.serviceRequired || 'Service Contract'}</div>
                            </div>
                            <div>
                                <span className="text-emerald-200 text-xs">Customer</span>
                                <div className="font-medium">{inviteData?.customerCompany || '—'}</div>
                            </div>
                            <div>
                                <span className="text-emerald-200 text-xs">Est. Value</span>
                                <div className="font-medium">
                                    {inviteData?.dealValue ? `£${Number(inviteData.dealValue).toLocaleString()}` : '—'}
                                </div>
                            </div>
                        </div>
                        <div className="text-sm">
                            <span className="bg-white/20 px-3 py-1 rounded-full">
                                {inviteData?.sessionNumber}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ================================================================ */}
            {/* SECTION 13: FORM CONTENT */}
            {/* ================================================================ */}
            <div className="max-w-3xl mx-auto px-4 py-8">
                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between mb-2">
                        <span className="text-sm text-slate-600">Step {currentStep} of {totalSteps}: {getStepName(currentStep)}</span>
                        <span className="text-sm text-slate-600">{Math.round((currentStep / totalSteps) * 100)}% Complete</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                            className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-4">
                        {[1, 2, 3, 4, 5].map((step) => (
                            <button
                                key={step}
                                onClick={() => setCurrentStep(step)}
                                className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${step === currentStep
                                        ? 'bg-emerald-600 text-white'
                                        : step < currentStep
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-slate-200 text-slate-500'
                                    }`}
                            >
                                {step < currentStep ? '✓' : step}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Form Steps */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
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
                        <CommercialTermsStep formData={formData} updateFormData={updateFormData} />
                    )}
                    {currentStep === 4 && (
                        <ComplianceSecurityStep
                            formData={formData}
                            updateFormData={updateFormData}
                            toggleArrayItem={toggleArrayItem}
                        />
                    )}
                    {currentStep === 5 && (
                        <ReviewStep formData={formData} inviteData={inviteData} />
                    )}
                </div>

                {/* Navigation Buttons */}
                <div className="mt-6 flex justify-between">
                    <button
                        onClick={prevStep}
                        disabled={currentStep === 1}
                        className={`px-6 py-2 rounded-lg transition-all ${currentStep === 1
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-600 text-white hover:bg-slate-700'
                            }`}
                    >
                        ← Previous
                    </button>

                    {currentStep < totalSteps ? (
                        <button
                            onClick={nextStep}
                            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all"
                        >
                            Next →
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="px-8 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Submitting...
                                </>
                            ) : (
                                <>Submit Capabilities →</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 14: STEP COMPONENTS
// ============================================================================

interface StepProps {
    formData: Partial<ProviderCapabilities>
    updateFormData: (field: keyof ProviderCapabilities, value: unknown) => void
}

interface ArrayStepProps extends StepProps {
    toggleArrayItem: (field: keyof ProviderCapabilities, item: string) => void
}

// STEP 1: Company Information
function CompanyInfoStep({ formData, updateFormData }: StepProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Company Information</h2>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        value={formData.companyName || ''}
                        onChange={(e) => updateFormData('companyName', e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Contact Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        value={formData.contactName || ''}
                        onChange={(e) => updateFormData('contactName', e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Contact Email <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="email"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        value={formData.contactEmail || ''}
                        onChange={(e) => updateFormData('contactEmail', e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
                    <input
                        type="url"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        placeholder="https://"
                        value={formData.website || ''}
                        onChange={(e) => updateFormData('website', e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Size</label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        value={formData.companySize || ''}
                        onChange={(e) => updateFormData('companySize', e.target.value)}
                    >
                        <option value="">Select Size</option>
                        <option value="1-50">Small (1-50 employees)</option>
                        <option value="51-200">Medium (51-200 employees)</option>
                        <option value="201-1000">Large (201-1000 employees)</option>
                        <option value="1000+">Enterprise (1000+ employees)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Years in Business</label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        value={formData.yearsInBusiness || ''}
                        onChange={(e) => updateFormData('yearsInBusiness', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="0-2">0-2 years</option>
                        <option value="3-5">3-5 years</option>
                        <option value="6-10">6-10 years</option>
                        <option value="11-20">11-20 years</option>
                        <option value="20+">20+ years</option>
                    </select>
                </div>
            </div>
        </div>
    )
}

// STEP 2: Service Capabilities
function ServiceCapabilitiesStep({ formData, updateFormData, toggleArrayItem }: ArrayStepProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Service Capabilities</h2>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Primary Service Specialization <span className="text-red-500">*</span>
                </label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={formData.serviceSpecialization || ''}
                    onChange={(e) => updateFormData('serviceSpecialization', e.target.value)}
                >
                    <option value="">Select Primary Service</option>
                    {SERVICE_OPTIONS.map(service => (
                        <option key={service} value={service}>{service}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Additional Services Offered</label>
                <div className="grid grid-cols-2 gap-2">
                    {SERVICE_OPTIONS.map(service => (
                        <label key={service} className="flex items-center gap-2 p-2 bg-slate-50 rounded cursor-pointer hover:bg-slate-100">
                            <input
                                type="checkbox"
                                checked={(formData.secondaryServices || []).includes(service)}
                                onChange={() => toggleArrayItem('secondaryServices', service)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-slate-700">{service}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Industry Expertise</label>
                <div className="grid grid-cols-2 gap-2">
                    {INDUSTRY_OPTIONS.map(industry => (
                        <label key={industry} className="flex items-center gap-2 p-2 bg-slate-50 rounded cursor-pointer hover:bg-slate-100">
                            <input
                                type="checkbox"
                                checked={(formData.industryExpertise || []).includes(industry)}
                                onChange={() => toggleArrayItem('industryExpertise', industry)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-slate-700">{industry}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Geographic Coverage</label>
                <div className="grid grid-cols-3 gap-2">
                    {GEOGRAPHY_OPTIONS.map(geo => (
                        <label key={geo} className="flex items-center gap-2 p-2 bg-slate-50 rounded cursor-pointer hover:bg-slate-100">
                            <input
                                type="checkbox"
                                checked={(formData.geographicCoverage || []).includes(geo)}
                                onChange={() => toggleArrayItem('geographicCoverage', geo)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-slate-700">{geo}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Available Capacity</label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        value={formData.availableCapacity || ''}
                        onChange={(e) => updateFormData('availableCapacity', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="immediately">Immediately Available</option>
                        <option value="2-weeks">Within 2 Weeks</option>
                        <option value="1-month">Within 1 Month</option>
                        <option value="limited">Limited Capacity</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Team Size for This Type of Work</label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        value={formData.teamSize || ''}
                        onChange={(e) => updateFormData('teamSize', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="1-10">1-10 people</option>
                        <option value="11-50">11-50 people</option>
                        <option value="51-200">51-200 people</option>
                        <option value="200+">200+ people</option>
                    </select>
                </div>
            </div>
        </div>
    )
}

// STEP 3: Commercial Terms
function CommercialTermsStep({ formData, updateFormData }: StepProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Commercial Terms</h2>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-emerald-800">
                    These terms help CLARENCE understand your commercial flexibility and find optimal terms for both parties.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Pricing Model</label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={formData.pricingModel || ''}
                    onChange={(e) => updateFormData('pricingModel', e.target.value)}
                >
                    <option value="">Select</option>
                    <option value="fixed">Fixed Price</option>
                    <option value="time-materials">Time & Materials</option>
                    <option value="per-transaction">Per Transaction</option>
                    <option value="per-fte">Per FTE</option>
                    <option value="outcome-based">Outcome-Based</option>
                    <option value="flexible">Flexible / Negotiable</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Hourly Rate Range: £{formData.rateRangeMin} - £{formData.rateRangeMax}
                </label>
                <div className="flex gap-4 items-center">
                    <input
                        type="range"
                        min="10"
                        max="200"
                        step="5"
                        className="flex-1"
                        value={formData.rateRangeMin || 25}
                        onChange={(e) => updateFormData('rateRangeMin', parseInt(e.target.value))}
                    />
                    <span className="text-sm text-slate-500">to</span>
                    <input
                        type="range"
                        min="10"
                        max="200"
                        step="5"
                        className="flex-1"
                        value={formData.rateRangeMax || 75}
                        onChange={(e) => updateFormData('rateRangeMax', parseInt(e.target.value))}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Minimum Contract Value</label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        value={formData.minimumContractValue || ''}
                        onChange={(e) => updateFormData('minimumContractValue', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="none">No Minimum</option>
                        <option value="10k">£10,000+</option>
                        <option value="50k">£50,000+</option>
                        <option value="100k">£100,000+</option>
                        <option value="250k">£250,000+</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Contract Duration</label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        value={formData.preferredDuration || ''}
                        onChange={(e) => updateFormData('preferredDuration', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="6-months">6 months</option>
                        <option value="12-months">12 months</option>
                        <option value="24-months">24 months</option>
                        <option value="36-months">36 months</option>
                        <option value="flexible">Flexible</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms Accepted</label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={formData.paymentTermsAccepted || ''}
                    onChange={(e) => updateFormData('paymentTermsAccepted', e.target.value)}
                >
                    <option value="">Select</option>
                    <option value="net-15">Net 15</option>
                    <option value="net-30">Net 30</option>
                    <option value="net-45">Net 45</option>
                    <option value="net-60">Net 60</option>
                    <option value="flexible">Flexible / Negotiable</option>
                </select>
            </div>
        </div>
    )
}

// STEP 4: Compliance & Security
function ComplianceSecurityStep({ formData, updateFormData, toggleArrayItem }: ArrayStepProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Compliance & Security</h2>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Certifications Held</label>
                <div className="grid grid-cols-2 gap-2">
                    {CERTIFICATION_OPTIONS.map(cert => (
                        <label key={cert} className="flex items-center gap-2 p-2 bg-slate-50 rounded cursor-pointer hover:bg-slate-100">
                            <input
                                type="checkbox"
                                checked={(formData.certifications || []).includes(cert)}
                                onChange={() => toggleArrayItem('certifications', cert)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-slate-700">{cert}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Data Security Level</label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        value={formData.dataSecurityLevel || ''}
                        onChange={(e) => updateFormData('dataSecurityLevel', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="basic">Basic</option>
                        <option value="standard">Standard (Industry Best Practice)</option>
                        <option value="enhanced">Enhanced (Regulated Industry)</option>
                        <option value="maximum">Maximum (Government Grade)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Insurance Coverage</label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        value={formData.insuranceCoverage || ''}
                        onChange={(e) => updateFormData('insuranceCoverage', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="1m">Up to £1M</option>
                        <option value="5m">Up to £5M</option>
                        <option value="10m">Up to £10M</option>
                        <option value="10m+">Over £10M</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <input
                    type="checkbox"
                    checked={formData.gdprCompliant || false}
                    onChange={(e) => updateFormData('gdprCompliant', e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-5 h-5"
                />
                <div>
                    <span className="text-sm font-medium text-slate-700">GDPR Compliant</span>
                    <p className="text-xs text-slate-500">We are fully compliant with GDPR requirements</p>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Key Differentiators
                </label>
                <textarea
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    rows={3}
                    placeholder="What makes your company stand out from competitors?"
                    value={formData.keyDifferentiators || ''}
                    onChange={(e) => updateFormData('keyDifferentiators', e.target.value)}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <input
                        type="checkbox"
                        checked={formData.referencesAvailable || false}
                        onChange={(e) => updateFormData('referencesAvailable', e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-5 h-5"
                    />
                    <span className="text-sm text-slate-700">Client References Available</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <input
                        type="checkbox"
                        checked={formData.caseStudiesAvailable || false}
                        onChange={(e) => updateFormData('caseStudiesAvailable', e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-5 h-5"
                    />
                    <span className="text-sm text-slate-700">Case Studies Available</span>
                </div>
            </div>
        </div>
    )
}

// STEP 5: Review & Submit
function ReviewStep({ formData, inviteData }: { formData: Partial<ProviderCapabilities>, inviteData: InviteData | null }) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Review & Submit</h2>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-emerald-800">
                    Please review your information before submitting. CLARENCE will use this to analyze compatibility and calculate optimal contract terms.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-medium text-slate-700 mb-2">Company</h3>
                    <p className="text-slate-800">{formData.companyName}</p>
                    <p className="text-sm text-slate-500">{formData.contactName} • {formData.contactEmail}</p>
                    <p className="text-sm text-slate-500">{formData.companySize} • {formData.yearsInBusiness} years</p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-medium text-slate-700 mb-2">Services</h3>
                    <p className="text-slate-800">{formData.serviceSpecialization}</p>
                    <p className="text-sm text-slate-500">
                        Industries: {(formData.industryExpertise || []).join(', ') || 'Not specified'}
                    </p>
                    <p className="text-sm text-slate-500">
                        Coverage: {(formData.geographicCoverage || []).join(', ') || 'Not specified'}
                    </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-medium text-slate-700 mb-2">Commercial</h3>
                    <p className="text-slate-800">£{formData.rateRangeMin} - £{formData.rateRangeMax}/hour</p>
                    <p className="text-sm text-slate-500">
                        Min Contract: {formData.minimumContractValue} • Duration: {formData.preferredDuration}
                    </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-medium text-slate-700 mb-2">Compliance</h3>
                    <p className="text-sm text-slate-600">
                        Certifications: {(formData.certifications || []).join(', ') || 'None specified'}
                    </p>
                    <p className="text-sm text-slate-500">
                        {formData.gdprCompliant ? '✓ GDPR Compliant' : '○ GDPR Compliance not confirmed'}
                    </p>
                </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-800 mb-2">What Happens Next?</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• CLARENCE will analyze your capabilities against {inviteData?.customerCompany || 'the customer'}&apos;s requirements</li>
                    <li>• Both parties&apos; leverage positions will be calculated</li>
                    <li>• You&apos;ll be notified when contract negotiation begins</li>
                </ul>
            </div>
        </div>
    )
}