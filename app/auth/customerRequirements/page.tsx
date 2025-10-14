'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { calculateLeverage, formDataToLeverageInputs } from '@/lib/calculateLeverage'

// ========== SECTION 1: INTERFACES ==========
interface CustomerRequirements {
    // Session & Company
    sessionId: string
    companyName: string
    companySize: string
    contactName: string
    contactEmail: string
    industry: string
    annualRevenue: string

    // Market Dynamics (for leverage - Algorithm 25% weight)
    numberOfBidders: string
    marketPosition: string
    decisionTimeline: string
    incumbentStatus: string

    // Service Requirements
    serviceRequired: string
    serviceCriticality: string
    businessChallenge: string
    desiredOutcome: string

    // BATNA (for leverage - Algorithm 25% weight)
    alternativeOptions: string
    inHouseCapability: string
    walkAwayPoint: string

    // Economic Factors (for leverage - Algorithm 25% weight)
    dealValue: string
    switchingCosts: string
    budgetFlexibility: string

    // Commercial Terms
    budgetMin: number
    budgetMax: number
    paymentTermsPreference: string
    contractDuration: string

    // Contract Positions (Customer's starting positions)
    contractPositions: {
        liabilityCap: number
        paymentTerms: number
        slaTarget: number
        dataRetention: number
        terminationNotice: number
    }

    // Priorities (point allocation per algorithm)
    priorities: {
        cost: number
        quality: number
        speed: number
        innovation: number
        riskMitigation: number
    }

    // Leverage calculation results
    leverageScore?: {
        customer: number
        provider: number
        customerPoints: number
        providerPoints: number
        factors: {
            market: { score: number; weight: number }
            economic: { score: number; weight: number }
            strategic: { score: number; weight: number }
            batna: { score: number; weight: number }
        }
    }
}

type NestedKeyOf<T> = keyof T | 'contractPositions' | 'priorities'

interface StepComponentProps {
    formData: Partial<CustomerRequirements>
    updateFormData: (field: keyof CustomerRequirements, value: string | number) => void
}

interface NestedStepComponentProps {
    formData: Partial<CustomerRequirements>
    updateNestedData: (section: NestedKeyOf<CustomerRequirements>, field: string, value: string | number) => void
}

interface PrioritiesStepProps extends NestedStepComponentProps {
    priorityPoints: number
}


// ========== SECTION 2: MAIN COMPONENT ==========
export default function CustomerRequirementsForm() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [currentStep, setCurrentStep] = useState(1)
    const [totalSteps] = useState(6)
    const [priorityPoints, setPriorityPoints] = useState(25)


    // ========== SECTION 3: FORM STATE ==========
    const [formData, setFormData] = useState<Partial<CustomerRequirements>>({
        contractPositions: {
            liabilityCap: 200,
            paymentTerms: 45,
            slaTarget: 99.5,
            dataRetention: 5,
            terminationNotice: 60
        },
        priorities: {
            cost: 5,
            quality: 5,
            speed: 5,
            innovation: 5,
            riskMitigation: 5
        }
    })

    // ========== SECTION 4: LEVERAGE CALCULATION ==========
    const calculateAndUpdateLeverage = useCallback(() => {
        // Only calculate if we have minimum required data
        if (!formData.numberOfBidders || !formData.serviceCriticality) {
            return
        }

        try {
            const leverageInputs = formDataToLeverageInputs(formData)
            const leverageResult = calculateLeverage(leverageInputs)

            setFormData(prev => ({
                ...prev,
                leverageScore: {
                    customer: leverageResult.customerLeverage,
                    provider: leverageResult.providerLeverage,
                    customerPoints: leverageResult.customerPoints,
                    providerPoints: leverageResult.providerPoints,
                    factors: leverageResult.factors
                }
            }))

            console.log('✅ Leverage calculated:', leverageResult)
        } catch (error) {
            console.error('❌ Leverage calculation error:', error)
        }
    }, [formData])

    // Recalculate leverage when relevant fields change
    useEffect(() => {
        if (currentStep >= 2) {
            calculateAndUpdateLeverage()
        }
    }, [
        formData.numberOfBidders,
        formData.marketPosition,
        formData.decisionTimeline,
        formData.serviceCriticality,
        formData.alternativeOptions,
        formData.budgetFlexibility,
        currentStep,
        calculateAndUpdateLeverage
    ])

    // ========== SECTION 5: VALIDATION FUNCTIONS ==========
    const validatePriorityPoints = useCallback(() => {
        const total = Object.values(formData.priorities || {}).reduce((sum, val) => sum + val, 0)
        const remaining = 25 - total
        setPriorityPoints(remaining)
        return remaining >= 0
    }, [formData.priorities])

    useEffect(() => {
        validatePriorityPoints()
    }, [validatePriorityPoints])

    // ========== SECTION 6: FORM HANDLERS ==========
    const updateFormData = (field: keyof CustomerRequirements, value: string | number) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }))
    }

    const updateNestedData = (section: NestedKeyOf<CustomerRequirements>, field: string, value: string | number) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...(prev[section as keyof CustomerRequirements] as Record<string, unknown>),
                [field]: value
            }
        }))
    }

    const handleSubmit = async () => {
        if (!validatePriorityPoints()) {
            alert('Please adjust priority points to not exceed 25')
            return
        }

        // Final leverage calculation
        calculateAndUpdateLeverage()

        setLoading(true)
        try {
            const submissionData = {
                ...formData,
                timestamp: new Date().toISOString(),
                formVersion: '5.0',
                formSource: 'customer-requirements-form',
                leverageCalculated: true
            }

            const response = await fetch('/api/customer-requirements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionData)
            })

            if (response.ok) {
                const result = await response.json()
                router.push(`/auth/assessment?session=${result.sessionId}`)
            } else {
                throw new Error('Submission failed')
            }
        } catch (error) {
            console.error('Submission error:', error)
            alert('Failed to submit requirements. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // ========== SECTION 7: STEP NAVIGATION ==========
    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, totalSteps))
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

    // ========== SECTION 8: RENDER STEPS ==========
    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <CompanyInfoStep formData={formData} updateFormData={updateFormData} />
            case 2:
                return <MarketContextStep formData={formData} updateFormData={updateFormData} />
            case 3:
                return <ServiceRequirementsStep formData={formData} updateFormData={updateFormData} />
            case 4:
                return <BATNAStep formData={formData} updateFormData={updateFormData} />
            case 5:
                return <ContractPositionsStep formData={formData} updateNestedData={updateNestedData} />
            case 6:
                return <PrioritiesStep formData={formData} updateNestedData={updateNestedData} priorityPoints={priorityPoints} />
            default:
                return null
        }
    }


    // ========== SECTION 9: MAIN RENDER ==========
    return (
        <div className="min-h-screen bg-slate-50">
            {/* Navigation */}
            <nav className="bg-white shadow-sm border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <span className="text-2xl font-medium text-slate-700">CLARENCE</span>
                            <span className="ml-4 text-slate-600 text-sm">Customer Requirements</span>
                        </div>
                        {formData.leverageScore && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-600">Your Leverage:</span>
                                <span className="font-bold text-green-600">{formData.leverageScore.customer}%</span>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            <div className="max-w-3xl mx-auto px-4 py-8">
                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between mb-2">
                        <span className="text-sm text-slate-600">Step {currentStep} of {totalSteps}</span>
                        <span className="text-sm text-slate-600">
                            {Math.round((currentStep / totalSteps) * 100)}% Complete
                        </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                            className="bg-gradient-to-r from-slate-600 to-slate-700 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Form Content */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                    {renderStep()}
                </div>

                {/* Navigation Buttons */}
                <div className="mt-6 flex justify-between">
                    <button
                        onClick={prevStep}
                        disabled={currentStep === 1}
                        className={`px-6 py-2 rounded-lg ${currentStep === 1
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-600 text-white hover:bg-slate-700'
                            }`}
                    >
                        Previous
                    </button>

                    {currentStep < totalSteps ? (
                        <button
                            onClick={nextStep}
                            className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading || priorityPoints < 0}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400"
                        >
                            {loading ? 'Submitting...' : 'Submit Requirements'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

// ========== SECTION 10: STEP COMPONENTS ==========

// ========== STEP 1 - COMPANY INFO ==========
function CompanyInfoStep({ formData, updateFormData }: StepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Company Information</h2>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Session ID <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        value={formData.sessionId || ''}
                        onChange={(e) => updateFormData('sessionId', e.target.value)}
                        placeholder="e.g., SIS-BACKOFFICE-2025-001"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        value={formData.companyName || ''}
                        onChange={(e) => updateFormData('companyName', e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Size</label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        value={formData.companySize || ''}
                        onChange={(e) => updateFormData('companySize', e.target.value)}
                    >
                        <option value="">Select Size</option>
                        <option value="1-50">Small (1-50)</option>
                        <option value="51-200">Medium (51-200)</option>
                        <option value="201-1000">Large (201-1000)</option>
                        <option value="1000+">Enterprise (1000+)</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Annual Revenue
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        value={formData.annualRevenue || ''}
                        onChange={(e) => updateFormData('annualRevenue', e.target.value)}
                    >
                        <option value="">Select Revenue</option>
                        <option value="<1M">Less than £1M</option>
                        <option value="1M-10M">£1M - £10M</option>
                        <option value="10M-50M">£10M - £50M</option>
                        <option value="50M-100M">£50M - £100M</option>
                        <option value="100M+">More than £100M</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Contact Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        value={formData.contactName || ''}
                        onChange={(e) => updateFormData('contactName', e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Contact Email <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="email"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        value={formData.contactEmail || ''}
                        onChange={(e) => updateFormData('contactEmail', e.target.value)}
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    value={formData.industry || ''}
                    onChange={(e) => updateFormData('industry', e.target.value)}
                    placeholder="e.g., Financial Services, Healthcare, Technology"
                />
            </div>
        </div>
    )
}

// Step 2: Market Context & Leverage
function MarketContextStep({ formData, updateFormData }: StepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Market Context & Leverage</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                    This information is critical for CLARENCE&apos;s leverage calculation algorithm, which determines negotiation dynamics.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Number of Competing Providers
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        value={formData.numberOfBidders || ''}
                        onChange={(e) => updateFormData('numberOfBidders', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="1">Sole source (no competition)</option>
                        <option value="2-3">2-3 providers</option>
                        <option value="4-6">4-6 providers</option>
                        <option value="7+">7+ providers</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Your Market Position
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        value={formData.marketPosition || ''}
                        onChange={(e) => updateFormData('marketPosition', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="Dominant">Dominant buyer</option>
                        <option value="Strong">Strong position</option>
                        <option value="Neutral">Neutral position</option>
                        <option value="Weak">Limited options</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Deal Value (£)
                    </label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        value={formData.dealValue || ''}
                        onChange={(e) => updateFormData('dealValue', e.target.value)}
                        placeholder="e.g., 500000"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Decision Timeline
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        value={formData.decisionTimeline || ''}
                        onChange={(e) => updateFormData('decisionTimeline', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="Immediate">Immediate (this week)</option>
                        <option value="Fast">Fast (2 weeks)</option>
                        <option value="Normal">Normal (1 month)</option>
                        <option value="Extended">Extended (2-3 months)</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Incumbent Status
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        value={formData.incumbentStatus || ''}
                        onChange={(e) => updateFormData('incumbentStatus', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="no-incumbent">No current provider</option>
                        <option value="replacing-poor">Replacing poor performer</option>
                        <option value="replacing-good">Replacing good performer</option>
                        <option value="expanding">Expanding current provider</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Estimated Switching Costs
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        value={formData.switchingCosts || ''}
                        onChange={(e) => updateFormData('switchingCosts', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="minimal">Minimal (&lt;£10k)</option>
                        <option value="moderate">Moderate (£10-50k)</option>
                        <option value="high">High (£50-200k)</option>
                        <option value="prohibitive">Prohibitive (&gt;£200k)</option>
                    </select>
                </div>
            </div>
        </div>
    )
}

// Step 3: Service Requirements
function ServiceRequirementsStep({ formData, updateFormData }: StepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Service Requirements</h2>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Service Category <span className="text-red-500">*</span>
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        value={formData.serviceRequired || ''}
                        onChange={(e) => updateFormData('serviceRequired', e.target.value)}
                    >
                        <option value="">Select Service</option>
                        <option value="Customer Support">Customer Support</option>
                        <option value="Technical Support">Technical Support</option>
                        <option value="Data Processing">Data Processing</option>
                        <option value="IT Services">IT Services</option>
                        <option value="Finance & Accounting">Finance & Accounting</option>
                        <option value="HR Services">HR Services</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Service Criticality (for leverage)
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                        value={formData.serviceCriticality || ''}
                        onChange={(e) => updateFormData('serviceCriticality', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="mission-critical">Mission Critical</option>
                        <option value="business-critical">Business Critical</option>
                        <option value="important">Important</option>
                        <option value="standard">Standard</option>
                        <option value="non-core">Non-core</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Business Challenge <span className="text-red-500">*</span>
                </label>
                <textarea
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    rows={3}
                    value={formData.businessChallenge || ''}
                    onChange={(e) => updateFormData('businessChallenge', e.target.value)}
                    placeholder="Describe the specific business challenge..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Desired Outcome <span className="text-red-500">*</span>
                </label>
                <textarea
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    rows={3}
                    value={formData.desiredOutcome || ''}
                    onChange={(e) => updateFormData('desiredOutcome', e.target.value)}
                    placeholder="What does success look like?"
                />
            </div>
        </div>
    )
}

// Step 4: BATNA Assessment (NEW)
function BATNAStep({ formData, updateFormData }: StepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Alternative Options (BATNA)</h2>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800">
                    Your Best Alternative to a Negotiated Agreement (BATNA) significantly impacts your leverage.
                    Be honest - this information helps CLARENCE negotiate effectively on your behalf.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    What are your alternatives if this negotiation fails?
                </label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    value={formData.alternativeOptions || ''}
                    onChange={(e) => updateFormData('alternativeOptions', e.target.value)}
                >
                    <option value="">Select</option>
                    <option value="strong-alternatives">Multiple strong alternatives available</option>
                    <option value="some-alternatives">Some viable alternatives exist</option>
                    <option value="limited-alternatives">Limited alternatives</option>
                    <option value="no-alternatives">No real alternatives</option>
                    <option value="in-house">Could bring in-house (with investment)</option>
                    <option value="delay">Could delay/defer the requirement</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    In-house capability to deliver this service?
                </label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    value={formData.inHouseCapability || ''}
                    onChange={(e) => updateFormData('inHouseCapability', e.target.value)}
                >
                    <option value="">Select</option>
                    <option value="full">Full capability exists</option>
                    <option value="partial">Partial capability (would need investment)</option>
                    <option value="buildable">Could build capability over time</option>
                    <option value="none">No in-house capability</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Walk-away point (maximum acceptable cost)
                </label>
                <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    value={formData.walkAwayPoint || ''}
                    onChange={(e) => updateFormData('walkAwayPoint', e.target.value)}
                    placeholder="e.g., £750,000 or 20% above budget"
                />
                <p className="text-xs text-slate-500 mt-1">This remains confidential and helps CLARENCE know your limits</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Budget Flexibility
                </label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    value={formData.budgetFlexibility || ''}
                    onChange={(e) => updateFormData('budgetFlexibility', e.target.value)}
                >
                    <option value="">Select</option>
                    <option value="fixed">Fixed budget - no flexibility</option>
                    <option value="limited">Limited flexibility (up to 5%)</option>
                    <option value="moderate">Moderate flexibility (5-15%)</option>
                    <option value="flexible">Flexible (15-25%)</option>
                    <option value="very-flexible">Very flexible (25%+)</option>
                </select>
            </div>
        </div>
    )
}

// Step 5: Contract Positions
function ContractPositionsStep({ formData, updateNestedData }: NestedStepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Initial Contract Positions</h2>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-800">
                    Set your starting positions on key contract terms. CLARENCE will use these as the basis for negotiation.
                </p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Liability Cap (% of annual contract value): {formData.contractPositions?.liabilityCap}%
                    </label>
                    <input
                        type="range"
                        min="100"
                        max="500"
                        step="25"
                        className="w-full"
                        value={formData.contractPositions?.liabilityCap || 200}
                        onChange={(e) => updateNestedData('contractPositions', 'liabilityCap', parseInt(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>100% (Low)</span>
                        <span>300% (Standard)</span>
                        <span>500% (High)</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Payment Terms (days): {formData.contractPositions?.paymentTerms} days
                    </label>
                    <input
                        type="range"
                        min="15"
                        max="90"
                        step="15"
                        className="w-full"
                        value={formData.contractPositions?.paymentTerms || 45}
                        onChange={(e) => updateNestedData('contractPositions', 'paymentTerms', parseInt(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>15 days</span>
                        <span>45 days</span>
                        <span>90 days</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        SLA Target (%): {formData.contractPositions?.slaTarget}%
                    </label>
                    <input
                        type="range"
                        min="95"
                        max="99.9"
                        step="0.1"
                        className="w-full"
                        value={formData.contractPositions?.slaTarget || 99.5}
                        onChange={(e) => updateNestedData('contractPositions', 'slaTarget', parseFloat(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>95% (Basic)</span>
                        <span>99% (Standard)</span>
                        <span>99.9% (Premium)</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Step 6: Priorities with Point System
function PrioritiesStep({ formData, updateNestedData, priorityPoints }: PrioritiesStepProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Priority Allocation</h2>

            <div className={`border rounded-lg p-4 mb-6 ${priorityPoints >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                <p className="text-sm font-medium mb-2">
                    Priority Points: {priorityPoints} / 25 remaining
                </p>
                <p className="text-xs text-slate-600">
                    Allocate 25 points total across priorities. This forces realistic trade-offs.
                </p>
            </div>

            <div className="space-y-4">
                {Object.entries({
                    cost: 'Cost Optimization',
                    quality: 'Quality Standards',
                    speed: 'Speed of Delivery',
                    innovation: 'Innovation & Technology',
                    riskMitigation: 'Risk Mitigation'
                }).map(([key, label]) => (
                    <div key={key}>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            {label}: {(formData.priorities as Record<string, number>)?.[key]} points
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="10"
                            step="1"
                            className="w-full"
                            value={(formData.priorities as Record<string, number>)?.[key] || 5}
                            onChange={(e) => updateNestedData('priorities', key, parseInt(e.target.value))}
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>0 (Not important)</span>
                            <span>5 (Moderate)</span>
                            <span>10 (Critical)</span>
                        </div>
                    </div>
                ))}
            </div>

            {priorityPoints < 0 && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    <p className="font-medium">Points exceeded!</p>
                    <p className="text-sm">Please reduce point allocations to stay within 25 total points.</p>
                </div>
            )}
        </div>
    )
}