'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ========== SECTION 1: INTERFACES ==========
interface ProviderCapabilities {
  // Company Information
  sessionId: string
  companyName: string
  companySize: string
  contactName: string
  contactEmail: string
  yearsInBusiness: string
  numberOfEmployees: number
  annualRevenue?: string // ADDED for leverage calculation
  
  // Market Position
  marketShare: string
  competitiveAdvantage: string
  clientPortfolioStrength: string
  demandLevel: string
  winRate: number
  pipelineStrength?: string // ADDED for BATNA
  
  // Service Capabilities
  serviceSpecialization: string
  capacityStatus: string
  teamSizeAvailable: string
  projectCapacity: number
  alternativeClients?: string // ADDED for BATNA
  
  // Commercial Terms
  rateMin: number
  rateMax: number
  projectMin: number
  projectMax: number
  paymentTermsStandard: string
  pricingFlexibility: number
  minimumDealSize?: string // ADDED
  
  // Contract Positions (Provider side)
  contractPositions: {
    liabilityCap: number
    paymentTerms: number
    slaCommitment: number
    dataRetention: number
    terminationNotice: number
  }
  
  // Flexibility Indicators
  flexibility: {
    pricing: number
    terms: number
    scope: number
    timeline: number
    location: number
  }
}

// ========== SECTION 2: MAIN COMPONENT ==========
export default function ProviderCapabilitiesForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [totalSteps] = useState(6)
  
  // ========== SECTION 3: FORM STATE ==========
  const [formData, setFormData] = useState<Partial<ProviderCapabilities>>({
    winRate: 50,
    projectCapacity: 5,
    pricingFlexibility: 5,
    contractPositions: {
      liabilityCap: 150,
      paymentTerms: 30,
      slaCommitment: 99.0,
      dataRetention: 3,
      terminationNotice: 90
    },
    flexibility: {
      pricing: 5,
      terms: 5,
      scope: 5,
      timeline: 5,
      location: 5
    }
  })

  // ========== SECTION 4: LEVERAGE CALCULATION ==========
  const calculateProviderLeverage = () => {
    let leverage = 50 // Base score
    
    // Market position factors
    if (formData.marketShare === 'Leader') leverage += 20
    else if (formData.marketShare === 'Emerging') leverage -= 10
    
    // Capacity factors
    if (formData.capacityStatus === 'Selective Intake') leverage += 15
    else if (formData.capacityStatus === 'High Availability') leverage -= 5
    
    // Demand factors
    if (formData.demandLevel === 'High Demand') leverage += 15
    else if (formData.demandLevel === 'Seeking Growth') leverage -= 10
    
    // Win rate factor
    if (formData.winRate >= 70) leverage += 10
    else if (formData.winRate <= 30) leverage -= 10
    
    return Math.max(20, Math.min(80, leverage))
  }

  // ========== SECTION 5: FORM HANDLERS ==========
  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const updateNestedData = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof ProviderCapabilities] as any,
        [field]: value
      }
    }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      // Calculate leverage score
      const leverageScore = calculateProviderLeverage()
      
      // Add metadata
      const submissionData = {
        ...formData,
        leverageScore,
        timestamp: new Date().toISOString(),
        formVersion: '2.0'
      }

      const response = await fetch('/api/provider-capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData)
      })

      if (response.ok) {
        const result = await response.json()
        router.push(`/auth/provider-dashboard?session=${result.sessionId}`)
      }
    } catch (error) {
      console.error('Submission error:', error)
    } finally {
      setLoading(false)
    }
  }

  // ========== SECTION 6: STEP NAVIGATION ==========
  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, totalSteps))
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

  // ========== SECTION 7: RENDER STEPS ==========
  const renderStep = () => {
    switch(currentStep) {
      case 1:
        return <CompanyInfoStep formData={formData} updateFormData={updateFormData} />
      case 2:
        return <MarketPositionStep formData={formData} updateFormData={updateFormData} />
      case 3:
        return <ServiceCapabilitiesStep formData={formData} updateFormData={updateFormData} />
      case 4:
        return <CommercialTermsStep formData={formData} updateFormData={updateFormData} />
      case 5:
        return <ContractPositionsStep formData={formData} updateNestedData={updateNestedData} />
      case 6:
        return <FlexibilityStep formData={formData} updateNestedData={updateNestedData} />
      default:
        return null
    }
  }

  // ========== SECTION 8: MAIN RENDER ==========
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-medium text-slate-700">CLARENCE</span>
              <span className="ml-4 text-slate-600 text-sm">Provider Capabilities</span>
            </div>
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
              className="bg-gradient-to-r from-green-600 to-green-700 h-2 rounded-full transition-all duration-300"
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
            className={`px-6 py-2 rounded-lg ${
              currentStep === 1 
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                : 'bg-slate-600 text-white hover:bg-slate-700'
            }`}
          >
            Previous
          </button>
          
          {currentStep < totalSteps ? (
            <button
              onClick={nextStep}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400"
            >
              {loading ? 'Submitting...' : 'Submit Capabilities'}
            </button>
          )}
        </div>

        {/* Leverage Preview */}
        {currentStep >= 3 && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-green-800">
                Estimated Provider Leverage:
              </span>
              <span className="text-lg font-bold text-green-700">
                {calculateProviderLeverage()}%
              </span>
            </div>
            <div className="mt-2 w-full bg-green-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${calculateProviderLeverage()}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ========== SECTION 9: STEP COMPONENTS ==========

// Step 1: Company Information
function CompanyInfoStep({ formData, updateFormData }: any) {
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
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.sessionId || ''}
            onChange={(e) => updateFormData('sessionId', e.target.value)}
            placeholder="Match customer's session ID"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.companyName || ''}
            onChange={(e) => updateFormData('companyName', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Company Size</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
            Annual Revenue (for leverage calculation)
          </label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.annualRevenue || ''}
            onChange={(e) => updateFormData('annualRevenue', e.target.value)}
          >
            <option value="">Select Revenue</option>
            <option value="<1M">Less than £1M</option>
            <option value="1-10M">£1M - £10M</option>
            <option value="10-50M">£10M - £50M</option>
            <option value="50-100M">£50M - £100M</option>
            <option value="100M+">More than £100M</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Years in Business</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.yearsInBusiness || ''}
            onChange={(e) => updateFormData('yearsInBusiness', e.target.value)}
          >
            <option value="">Select</option>
            <option value="0-2">0-2 years</option>
            <option value="3-5">3-5 years</option>
            <option value="6-10">6-10 years</option>
            <option value="11-15">11-15 years</option>
            <option value="15+">15+ years</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Number of Employees
          </label>
          <input
            type="number"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.numberOfEmployees || ''}
            onChange={(e) => updateFormData('numberOfEmployees', parseInt(e.target.value))}
          />
        </div>
      </div>
    </div>
  )
}

// Step 2: Market Position
function MarketPositionStep({ formData, updateFormData }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-medium text-slate-800 mb-4">Market Position & Leverage</h2>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          This information determines your leverage position in CLARENCE's negotiation algorithm.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Market Position</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.marketShare || ''}
            onChange={(e) => updateFormData('marketShare', e.target.value)}
          >
            <option value="">Select</option>
            <option value="Leader">Market leader (top 3)</option>
            <option value="Established">Established (top 10)</option>
            <option value="Specialist">Niche specialist</option>
            <option value="Emerging">Emerging provider</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Current Demand Level
          </label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.demandLevel || ''}
            onChange={(e) => updateFormData('demandLevel', e.target.value)}
          >
            <option value="">Select</option>
            <option value="High Demand">High demand (selective)</option>
            <option value="Steady Demand">Steady demand</option>
            <option value="Building Demand">Building demand</option>
            <option value="Seeking Growth">Seeking growth</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Typical Win Rate: {formData.winRate}%
        </label>
        <input
          type="range"
          min="10"
          max="90"
          step="10"
          className="w-full"
          value={formData.winRate || 50}
          onChange={(e) => updateFormData('winRate', parseInt(e.target.value))}
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>10% (Low)</span>
          <span>50% (Average)</span>
          <span>90% (High)</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Pipeline Strength (BATNA)
          </label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.pipelineStrength || ''}
            onChange={(e) => updateFormData('pipelineStrength', e.target.value)}
          >
            <option value="">Select</option>
            <option value="full">Full pipeline - can be selective</option>
            <option value="healthy">Healthy pipeline</option>
            <option value="light">Light pipeline</option>
            <option value="desperate">Need new business urgently</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Alternative Clients Available?
          </label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.alternativeClients || ''}
            onChange={(e) => updateFormData('alternativeClients', e.target.value)}
          >
            <option value="">Select</option>
            <option value="many">Many alternatives</option>
            <option value="several">Several alternatives</option>
            <option value="few">Few alternatives</option>
            <option value="none">This is critical</option>
          </select>
        </div>
      </div>
    </div>
  )
}

// Step 3: Service Capabilities
function ServiceCapabilitiesStep({ formData, updateFormData }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-medium text-slate-800 mb-4">Service Capabilities</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Primary Specialization <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.serviceSpecialization || ''}
            onChange={(e) => updateFormData('serviceSpecialization', e.target.value)}
          >
            <option value="">Select</option>
            <option value="Customer Support">Customer Support</option>
            <option value="Technical Support">Technical Support</option>
            <option value="IT Services">IT Services</option>
            <option value="Data Processing">Data Processing</option>
            <option value="Finance & Accounting">Finance & Accounting</option>
            <option value="Multi-service">Multi-service Provider</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Current Capacity Status
          </label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.capacityStatus || ''}
            onChange={(e) => updateFormData('capacityStatus', e.target.value)}
          >
            <option value="">Select</option>
            <option value="High Availability">High availability</option>
            <option value="Available">Available</option>
            <option value="Limited Availability">Limited availability</option>
            <option value="Near Capacity">Near capacity</option>
            <option value="Selective Intake">Selective intake only</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Team Size Available
          </label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.teamSizeAvailable || ''}
            onChange={(e) => updateFormData('teamSizeAvailable', e.target.value)}
          >
            <option value="">Select</option>
            <option value="1-5">1-5 people</option>
            <option value="6-15">6-15 people</option>
            <option value="16-30">16-30 people</option>
            <option value="31-50">31-50 people</option>
            <option value="50+">50+ people</option>
            <option value="Scalable">Scalable as needed</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Concurrent Projects: {formData.projectCapacity}
          </label>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            className="w-full"
            value={formData.projectCapacity || 5}
            onChange={(e) => updateFormData('projectCapacity', parseInt(e.target.value))}
          />
        </div>
      </div>
    </div>
  )
}

// Step 4: Commercial Terms
function CommercialTermsStep({ formData, updateFormData }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-medium text-slate-800 mb-4">Commercial Terms</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Minimum Rate (£/hour)
          </label>
          <input
            type="number"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.rateMin || ''}
            onChange={(e) => updateFormData('rateMin', parseInt(e.target.value))}
            placeholder="e.g., 25"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Maximum Rate (£/hour)
          </label>
          <input
            type="number"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.rateMax || ''}
            onChange={(e) => updateFormData('rateMax', parseInt(e.target.value))}
            placeholder="e.g., 75"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Minimum Project Value (£)
          </label>
          <input
            type="number"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.projectMin || ''}
            onChange={(e) => updateFormData('projectMin', parseInt(e.target.value))}
            placeholder="e.g., 50000"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Maximum Project Value (£)
          </label>
          <input
            type="number"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            value={formData.projectMax || ''}
            onChange={(e) => updateFormData('projectMax', parseInt(e.target.value))}
            placeholder="e.g., 1000000"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Standard Payment Terms
        </label>
        <select
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
          value={formData.paymentTermsStandard || ''}
          onChange={(e) => updateFormData('paymentTermsStandard', e.target.value)}
        >
          <option value="">Select</option>
          <option value="Net 30">Net 30 days</option>
          <option value="Net 45">Net 45 days</option>
          <option value="Net 60">Net 60 days</option>
          <option value="Advance">Monthly in advance</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Pricing Flexibility: {formData.pricingFlexibility}/10
        </label>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          className="w-full"
          value={formData.pricingFlexibility || 5}
          onChange={(e) => updateFormData('pricingFlexibility', parseInt(e.target.value))}
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>No flexibility</span>
          <span>Moderate</span>
          <span>Very flexible</span>
        </div>
      </div>
    </div>
  )
}

// Step 5: Contract Positions
function ContractPositionsStep({ formData, updateNestedData }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-medium text-slate-800 mb-4">Standard Contract Positions</h2>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-yellow-800">
          Set your standard positions. CLARENCE will negotiate from these starting points.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Liability Cap Offered: {formData.contractPositions?.liabilityCap}%
          </label>
          <input
            type="range"
            min="100"
            max="300"
            step="25"
            className="w-full"
            value={formData.contractPositions?.liabilityCap || 150}
            onChange={(e) => updateNestedData('contractPositions', 'liabilityCap', parseInt(e.target.value))}
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>100% (Minimum)</span>
            <span>200% (Standard)</span>
            <span>300% (Maximum)</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Payment Terms Standard: {formData.contractPositions?.paymentTerms} days
          </label>
          <input
            type="range"
            min="15"
            max="60"
            step="15"
            className="w-full"
            value={formData.contractPositions?.paymentTerms || 30}
            onChange={(e) => updateNestedData('contractPositions', 'paymentTerms', parseInt(e.target.value))}
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>15 days</span>
            <span>30 days</span>
            <span>60 days</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            SLA Commitment: {formData.contractPositions?.slaCommitment}%
          </label>
          <input
            type="range"
            min="95"
            max="99.9"
            step="0.1"
            className="w-full"
            value={formData.contractPositions?.slaCommitment || 99.0}
            onChange={(e) => updateNestedData('contractPositions', 'slaCommitment', parseFloat(e.target.value))}
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

// Step 6: Flexibility Indicators
function FlexibilityStep({ formData, updateNestedData }: any) {
  const totalFlexibility = Object.values(formData.flexibility || {}).reduce((sum: number, val: any) => sum + val, 0)
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-medium text-slate-800 mb-4">Negotiation Flexibility</h2>
      
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-green-800">
          Rate your flexibility in different areas. This helps CLARENCE identify win-win opportunities.
        </p>
        <p className="text-xs text-green-600 mt-2">
          Total Flexibility Score: {totalFlexibility} / 50
        </p>
      </div>

      <div className="space-y-4">
        {Object.entries({
          pricing: 'Pricing Flexibility',
          terms: 'Payment Terms Flexibility',
          scope: 'Scope Flexibility',
          timeline: 'Timeline Flexibility',
          location: 'Location/Remote Flexibility'
        }).map(([key, label]) => (
          <div key={key}>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {label}: {formData.flexibility?.[key]} / 10
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              className="w-full"
              value={formData.flexibility?.[key] || 5}
              onChange={(e) => updateNestedData('flexibility', key, parseInt(e.target.value))}
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>No flexibility</span>
              <span>Some flexibility</span>
              <span>Very flexible</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 mb-2">Flexibility Summary</h4>
        <p className="text-xs text-blue-700">
          {totalFlexibility > 40 ? 'High flexibility - excellent for finding creative solutions' :
           totalFlexibility > 25 ? 'Moderate flexibility - good negotiation position' :
           'Limited flexibility - may need to prioritize key areas'}
        </p>
      </div>
    </div>
  )
}