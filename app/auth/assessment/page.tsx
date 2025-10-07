'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ========== SECTION 1: INTERFACES ==========
interface Session {
  sessionId: string
  sessionNumber?: string
  customerCompany: string
  providerCompany?: string
  serviceRequired: string
  dealValue: string
  status: string
  phase?: number
  phaseAlignment?: number
}

interface Provider {
  providerId: string
  providerName: string
  providerAddress?: string
  providerEntity?: string
  providerIncorporation?: string
  providerTurnover?: string
  providerEmployees?: string
  providerExperience?: string
}

interface DealProfile {
  services: string
  deliveryLocations: string[]
  serviceLocations: string[]
  pricingApproach: string
  pricingExpectation: string
}

interface PartyFit {
  customerName: string
  customerAddress: string
  customerEntity: string
  customerIncorporation: string
  customerTurnover: string
  providerName: string
  providerAddress: string
  providerEntity: string
  providerIncorporation: string
  providerTurnover: string
  providerEmployees: string
  providerExperience: string
  parentGuarantee: boolean
  references: string[]
}

interface LeverageFactors {
  dealSize: string
  contractDuration: string
  industrySector: string
  serviceType: string
  partyFitScore: number
}

// ========== SECTION 2: MAIN COMPONENT START ==========
function PreliminaryAssessmentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // ========== SECTION 3: STATE DECLARATIONS ==========
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [activeSection, setActiveSection] = useState<'profile' | 'fit' | 'leverage'>('profile')
  const [leverageScore, setLeverageScore] = useState({ customer: 50, provider: 50 })
  const [assessmentComplete, setAssessmentComplete] = useState(false)
  const [loadingCapabilities, setLoadingCapabilities] = useState(false)
  
  const [dealProfile, setDealProfile] = useState<DealProfile>({
    services: '',
    deliveryLocations: [],
    serviceLocations: [],
    pricingApproach: '',
    pricingExpectation: ''
  })

  const [partyFit, setPartyFit] = useState<PartyFit>({
    customerName: '',
    customerAddress: '',
    customerEntity: '',
    customerIncorporation: '',
    customerTurnover: '',
    providerName: '',
    providerAddress: '',
    providerEntity: '',
    providerIncorporation: '',
    providerTurnover: '',
    providerEmployees: '',
    providerExperience: '',
    parentGuarantee: false,
    references: []
  })

  const [leverageFactors, setLeverageFactors] = useState<LeverageFactors>({
    dealSize: '',
    contractDuration: '',
    industrySector: '',
    serviceType: '',
    partyFitScore: 0
  })

  // ========== SECTION 4: FUNCTIONS ==========
  const selectProvider = useCallback(async (provider: Provider) => {
    console.log('selectProvider called with:', provider)
    console.log('Current session:', session)
    
    setSelectedProvider(provider)
    setLoadingCapabilities(true)
    
    // Pre-fill basic provider information in party fit
    setPartyFit(prev => ({
      ...prev,
      providerName: provider.providerName || '',
      providerAddress: provider.providerAddress || '',
      providerEntity: provider.providerEntity || '',
      providerIncorporation: provider.providerIncorporation || '',
      providerTurnover: provider.providerTurnover || '',
      providerEmployees: provider.providerEmployees || '',
      providerExperience: provider.providerExperience || ''
    }))
    
    // Get session ID - check multiple sources
    const currentSessionId = session?.sessionId || 
                           searchParams.get('session') || 
                           localStorage.getItem('currentSessionId')
    
    console.log('Using sessionId for capabilities:', currentSessionId)
    console.log('Provider ID:', provider.providerId)
    
    // Load detailed provider capabilities
    if (provider.providerId && currentSessionId) {
      console.log('Loading provider capabilities for:', provider.providerId)
      try {
        // Use parameter names that the webhook expects (session_id and provider_id)
        const apiUrl = `https://spikeislandstudios.app.n8n.cloud/webhook/provider-capabilities-api?session_id=${currentSessionId}&provider_id=${provider.providerId}`
        console.log('Fetching capabilities from:', apiUrl)
        
        const response = await fetch(apiUrl)
        if (response.ok) {
          const result = await response.json()
          console.log('Capabilities response:', result)
          console.log('Response type:', typeof result)
          console.log('Response keys:', Object.keys(result))
          
          // Log the full structure for debugging
          console.log('Full response structure:', JSON.stringify(result, null, 2))
          
          // Extract the data from the response structure
          let capabilityData = null
          
          // The response you showed earlier was an array with one object
          if (Array.isArray(result) && result.length > 0) {
            console.log('Response is array, extracting first item')
            capabilityData = result[0].data
          } else if (result.data) {
            console.log('Response has data property')
            capabilityData = result.data
          } else if (result.success && result.count > 0) {
            console.log('Response has success flag but no data property')
            // Maybe the whole result is the data?
            capabilityData = result
          } else {
            console.log('Using entire response as capability data')
            capabilityData = result
          }
          
          if (capabilityData) {
            console.log('Provider capability data structure:', capabilityData)
            console.log('Capability data keys:', Object.keys(capabilityData))
            
// Update party fit with detailed provider information
if (capabilityData.provider) {
  console.log('Updating from provider data:', capabilityData.provider)
  setPartyFit(prev => ({
    ...prev,
    providerName: capabilityData.provider.company || prev.providerName,
    providerEntity: capabilityData.provider.industry !== 'undefined' ? capabilityData.provider.industry : prev.providerEntity,
    providerAddress: capabilityData.provider.address || prev.providerAddress
  }))
}
            
            // Update with company capabilities
            if (capabilityData.capabilities?.company) {
              const company = capabilityData.capabilities.company
              console.log('Updating from company capabilities:', company)
              setPartyFit(prev => ({
                ...prev,
                providerEmployees: company.numberOfEmployees?.toString() || company.size || prev.providerEmployees,
                providerTurnover: company.annualRevenue || `Market: ${company.marketShare}` || prev.providerTurnover,
                providerExperience: company.yearsInBusiness || prev.providerExperience
              }))
              
              // Add notable clients info if available
              if (company.notableClients) {
                setPartyFit(prev => ({
                  ...prev,
                  references: [company.notableClients]
                }))
              }
            }
            
            // Update leverage scores if available
            if (capabilityData.leverage) {
              console.log('Updating leverage scores:', capabilityData.leverage)
              const customerLev = parseInt(capabilityData.leverage.customerLeverage) || 50
              const providerLev = parseInt(capabilityData.leverage.providerLeverage) || 50
              setLeverageScore({
                customer: customerLev,
                provider: providerLev
              })
              
              // Also update leverage factors with alignment score
              if (capabilityData.leverage.alignmentScore) {
                setLeverageFactors(prev => ({
                  ...prev,
                  partyFitScore: parseFloat(capabilityData.leverage.alignmentScore) || 0
                }))
              }
            }
            
            // Update deal profile with service information
            if (capabilityData.capabilities?.services) {
              const services = capabilityData.capabilities.services
              console.log('Updating services:', services)
              setDealProfile(prev => ({
                ...prev,
                services: services.primary || prev.services || '',
                serviceLocations: services.geographicCoverage ? 
                  services.geographicCoverage.split(',').map((s: string) => s.trim()) : 
                  prev.serviceLocations
              }))
            }
            
            // Update leverage factors with commercial info
            if (capabilityData.capabilities?.commercial) {
              const commercial = capabilityData.capabilities.commercial
              console.log('Updating commercial info:', commercial)
              
              // Calculate average project value
              if (commercial.projectMin && commercial.projectMax) {
                const avgValue = (commercial.projectMin + commercial.projectMax) / 2
                setLeverageFactors(prev => ({
                  ...prev,
                  dealSize: avgValue.toString()
                }))
              }
              
              // Update pricing expectations
              if (commercial.rateMin && commercial.rateMax) {
                setDealProfile(prev => ({
                  ...prev,
                  pricingExpectation: `£${commercial.rateMin} - £${commercial.rateMax} per hour`
                }))
              }
            }
            
            // Update operational preferences
            if (capabilityData.capabilities?.operational) {
              const operational = capabilityData.capabilities.operational
              console.log('Updating operational info:', operational)
              
              // Update delivery locations
              if (operational.geographicCoverage) {
                setDealProfile(prev => ({
                  ...prev,
                  deliveryLocations: operational.geographicCoverage.split(',').map((s: string) => s.trim())
                }))
              }
            }
            
            // Store full capability data for reference
            localStorage.setItem(`provider_capabilities_${provider.providerId}`, JSON.stringify(capabilityData))
            console.log('Successfully stored capability data for provider:', provider.providerId)
          } else {
            console.log('No capability data found in response')
        }
        } else {
          console.error('Failed to load provider capabilities:', response.status)
        }
        } catch (error) {
      console.error('Error loading provider capabilities:', error)
      } finally {
        setLoadingCapabilities(false)
      }
    } else {
      setLoadingCapabilities(false)
    }
  }, [session?.sessionId, searchParams])

  const loadProviders = useCallback(async (sessionId: string, targetProviderId?: string) => {
    try {
      console.log('Loading providers for session:', sessionId, 'targetProviderId:', targetProviderId)
      
      // For demo mode, use mock providers
      if (sessionId === 'demo-session') {
        console.log('Creating demo providers')
        const demoProviders: Provider[] = [
          {
            providerId: 'provider-1',
            providerName: 'TechCorp Solutions',
            providerTurnover: '£10M',
            providerEmployees: '250',
            providerExperience: 'Extensive experience in IT consulting'
          },
          {
            providerId: 'provider-2',
            providerName: 'Global Services Ltd',
            providerTurnover: '£25M',
            providerEmployees: '500',
            providerExperience: 'Leading provider of managed services'
          }
        ]
        setProviders(demoProviders)
        return
      }

      // For real sessions, use 'session' parameter
      const apiUrl = `https://spikeislandstudios.app.n8n.cloud/webhook/session-providers?session=${sessionId}`
      console.log('Loading providers from API:', apiUrl)
      
      const response = await fetch(apiUrl)
      if (response.ok) {
        const data = await response.json()
        console.log('Full providers data received:', data)
        console.log('Data type:', typeof data)
        console.log('Is array?', Array.isArray(data))
        
        // The webhook seems to return an object, possibly with providers as a property
        let providersArray: Provider[] = []
        
        if (Array.isArray(data)) {
          console.log('Data is an array with', data.length, 'items')
          providersArray = data.map(item => ({
            providerId: item.providerId || item.provider_id || item.id,
            providerName: item.providerName || item.provider_name || item.name || 'Unknown Provider',
            providerAddress: item.providerAddress || item.provider_address || item.address,
            providerEntity: item.providerEntity || item.provider_entity || item.entity,
            providerIncorporation: item.providerIncorporation || item.provider_incorporation || item.incorporation,
            providerTurnover: item.providerTurnover || item.provider_turnover || item.turnover,
            providerEmployees: item.providerEmployees || item.provider_employees || item.employees,
            providerExperience: item.providerExperience || item.provider_experience || item.experience
          }))
        } else if (data && typeof data === 'object') {
          console.log('Data is an object, keys:', Object.keys(data))
          
          // Try different possible structures
          if (data.providers && Array.isArray(data.providers)) {
            console.log('Found providers array in data.providers')
            console.log('First provider in array:', data.providers[0])
            // Map the providers from the nested array
            providersArray = data.providers.map((item: Record<string, unknown>) => ({
              providerId: (item.providerId || item.provider_id || item.id || `provider-${sessionId}-${Math.random()}`) as string,
              providerName: (item.providerName || item.provider_name || item.name || item.providerCompany || item.provider_company || 'Unknown Provider') as string,
              providerAddress: (item.providerAddress || item.provider_address || item.address) as string | undefined,
              providerEntity: (item.providerEntity || item.provider_entity || item.entity) as string | undefined,
              providerIncorporation: (item.providerIncorporation || item.provider_incorporation || item.incorporation) as string | undefined,
              providerTurnover: (item.providerTurnover || item.provider_turnover || item.turnover) as string | undefined,
              providerEmployees: (item.providerEmployees || item.provider_employees || item.employees) as string | undefined,
              providerExperience: (item.providerExperience || item.provider_experience || item.experience) as string | undefined
            }))
          } else if (data.data && Array.isArray(data.data)) {
            console.log('Found providers array in data.data')
            providersArray = data.data.map((item: Record<string, unknown>) => ({
              providerId: (item.providerId || item.provider_id || item.id || `provider-${sessionId}-${Math.random()}`) as string,
              providerName: (item.providerName || item.provider_name || item.name || item.providerCompany || item.provider_company || 'Unknown Provider') as string,
              providerAddress: (item.providerAddress || item.provider_address || item.address) as string | undefined,
              providerEntity: (item.providerEntity || item.provider_entity || item.entity) as string | undefined,
              providerIncorporation: (item.providerIncorporation || item.provider_incorporation || item.incorporation) as string | undefined,
              providerTurnover: (item.providerTurnover || item.provider_turnover || item.turnover) as string | undefined,
              providerEmployees: (item.providerEmployees || item.provider_employees || item.employees) as string | undefined,
              providerExperience: (item.providerExperience || item.provider_experience || item.experience) as string | undefined
            }))
          } else if (data.items && Array.isArray(data.items)) {
            console.log('Found providers array in data.items')
            providersArray = data.items.map((item: Record<string, unknown>) => ({
              providerId: (item.providerId || item.provider_id || item.id || `provider-${sessionId}-${Math.random()}`) as string,
              providerName: (item.providerName || item.provider_name || item.name || item.providerCompany || item.provider_company || 'Unknown Provider') as string,
              providerAddress: (item.providerAddress || item.provider_address || item.address) as string | undefined,
              providerEntity: (item.providerEntity || item.provider_entity || item.entity) as string | undefined,
              providerIncorporation: (item.providerIncorporation || item.provider_incorporation || item.incorporation) as string | undefined,
              providerTurnover: (item.providerTurnover || item.provider_turnover || item.turnover) as string | undefined,
              providerEmployees: (item.providerEmployees || item.provider_employees || item.employees) as string | undefined,
              providerExperience: (item.providerExperience || item.provider_experience || item.experience) as string | undefined
            }))
          } else {
            // Check if the object itself looks like a single provider
            const hasProviderFields = data.providerId || data.provider_id || 
                                     data.providerName || data.provider_name ||
                                     data.id || data.name
            
            if (hasProviderFields) {
              console.log('Data appears to be a single provider object')
              const provider: Provider = {
                providerId: data.providerId || data.provider_id || data.id || `provider-${sessionId}`,
                providerName: data.providerName || data.provider_name || data.name || 'Provider',
                providerAddress: data.providerAddress || data.provider_address || data.address,
                providerEntity: data.providerEntity || data.provider_entity || data.entity,
                providerIncorporation: data.providerIncorporation || data.provider_incorporation || data.incorporation,
                providerTurnover: data.providerTurnover || data.provider_turnover || data.turnover,
                providerEmployees: data.providerEmployees || data.provider_employees || data.employees,
                providerExperience: data.providerExperience || data.provider_experience || data.experience
              }
              providersArray = [provider]
            } else {
              // Try to find any array property that might contain providers
              console.log('Looking for arrays in object properties...')
              for (const [key, value] of Object.entries(data)) {
                if (Array.isArray(value) && value.length > 0) {
                  console.log(`Found array in property '${key}' with ${value.length} items`)
                  // Check if first item looks like a provider
                  const firstItem = value[0] as Record<string, unknown>
                  if (firstItem && (
                      firstItem.providerId || firstItem.provider_id || 
                      firstItem.providerName || firstItem.provider_name ||
                      firstItem.id || firstItem.name)) {
                    console.log(`Using array from '${key}' as providers`)
                    providersArray = (value as Array<Record<string, unknown>>).map((item: Record<string, unknown>) => ({
                      providerId: (item.providerId || item.provider_id || item.id) as string,
                      providerName: (item.providerName || item.provider_name || item.name || 'Unknown Provider') as string,
                      providerAddress: (item.providerAddress || item.provider_address || item.address) as string | undefined,
                      providerEntity: (item.providerEntity || item.provider_entity || item.entity) as string | undefined,
                      providerIncorporation: (item.providerIncorporation || item.provider_incorporation || item.incorporation) as string | undefined,
                      providerTurnover: (item.providerTurnover || item.provider_turnover || item.turnover) as string | undefined,
                      providerEmployees: (item.providerEmployees || item.provider_employees || item.employees) as string | undefined,
                      providerExperience: (item.providerExperience || item.provider_experience || item.experience) as string | undefined
                    }))
                    break
                  }
                }
              }
            }
          }
        }
        
        console.log('Final processed providers array:', providersArray)
        if (providersArray.length > 0) {
          console.log('First provider details:', providersArray[0])
        }
        
        if (providersArray.length > 0) {
          setProviders(providersArray)
          
          // If a specific provider was requested, auto-select it
          if (targetProviderId) {
            const targetProvider = providersArray.find(
              p => p.providerId === targetProviderId
            )
            if (targetProvider) {
              console.log('Auto-selecting target provider:', targetProvider)
              selectProvider(targetProvider)
            }
          } else if (providersArray.length === 1) {
            // Auto-select if only one provider
            console.log('Auto-selecting single provider')
            selectProvider(providersArray[0])
          }
        } else {
          // No valid providers found
          console.log('No valid providers found, creating defaults')
          const defaultProviders: Provider[] = [
            {
              providerId: `provider-${sessionId}-1`,
              providerName: session?.providerCompany || 'Provider Company A',
              providerTurnover: 'Not specified',
              providerEmployees: 'Not specified'
            }
          ]
          setProviders(defaultProviders)
        }
      } else {
        console.error('Failed to load providers - Status:', response.status)
        // Try to read error message
        const errorText = await response.text()
        console.error('Error response:', errorText)
        
        // Create fallback provider
        const fallbackProvider: Provider[] = [{
          providerId: `provider-${sessionId}-fallback`,
          providerName: session?.providerCompany || 'Selected Provider',
          providerTurnover: 'Not specified',
          providerEmployees: 'Not specified'
        }]
        setProviders(fallbackProvider)
      }
    } catch (error) {
      console.error('Error loading providers:', error)
      // Create fallback provider
      const fallbackProvider: Provider[] = [{
        providerId: `provider-${sessionId}-error`,
        providerName: session?.providerCompany || 'Available Provider',
        providerTurnover: 'Not specified',
        providerEmployees: 'Not specified'
      }]
      setProviders(fallbackProvider)
    }
  }, [selectProvider, session?.providerCompany])

  const loadSessionData = useCallback(async () => {
    try {
      // Get session ID and provider ID from URL params
      let sessionId = searchParams.get('session')
      const providerId = searchParams.get('provider')
      
      console.log('Loading session data - sessionId:', sessionId, 'providerId:', providerId)
      
      // If no session ID in URL, check localStorage
      if (!sessionId) {
        const storedSessionId = localStorage.getItem('currentSessionId')
        const storedSession = localStorage.getItem('currentSession')
        
        if (storedSessionId && storedSession) {
          // Use stored session data
          const sessionData = JSON.parse(storedSession)
          setSession(sessionData)
          setDealProfile(prev => ({
            ...prev,
            services: sessionData.serviceRequired || ''
          }))
          setLeverageFactors(prev => ({
            ...prev,
            dealSize: sessionData.dealValue || ''
          }))
          sessionId = storedSessionId
        } else {
          // Demo mode
          console.log('No session found, entering demo mode')
          const demoSession: Session = {
            sessionId: 'demo-session',
            sessionNumber: 'DEMO-001',
            customerCompany: 'Demo Customer Ltd',
            serviceRequired: 'IT Consulting Services',
            dealValue: '500000',
            status: 'initiated',
            phase: 1
          }
          setSession(demoSession)
          sessionId = 'demo-session'
        }
      } else {
        // Load session from localStorage if available
        const cachedSession = localStorage.getItem('currentSession')
        if (cachedSession) {
          const sessionData = JSON.parse(cachedSession)
          setSession(sessionData)
          setDealProfile(prev => ({
            ...prev,
            services: sessionData.serviceRequired || ''
          }))
          setLeverageFactors(prev => ({
            ...prev,
            dealSize: sessionData.dealValue || ''
          }))
        }
      }

      // Store provider ID if provided
      if (providerId) {
        localStorage.setItem('selectedProviderId', providerId)
      }

      // Load providers for this session
      if (sessionId) {
        await loadProviders(sessionId, providerId || undefined)
      }
      
    } catch (error) {
      console.error('Error loading session data:', error)
    } finally {
      setLoading(false)
    }
  }, [searchParams, loadProviders])

  const calculateLeverage = () => {
    let customerLeverage = 50
    
    const dealValue = parseInt(leverageFactors.dealSize.replace(/\D/g, '')) || 0
    if (dealValue > 5000000) customerLeverage += 10
    else if (dealValue > 1000000) customerLeverage += 5
    
    const duration = parseInt(leverageFactors.contractDuration) || 0
    if (duration > 36) customerLeverage += 5
    else if (duration < 12) customerLeverage -= 5
    
    if (leverageFactors.partyFitScore > 80) customerLeverage += 10
    else if (leverageFactors.partyFitScore < 50) customerLeverage -= 10
    
    customerLeverage = Math.max(20, Math.min(80, customerLeverage))
    
    setLeverageScore({
      customer: customerLeverage,
      provider: 100 - customerLeverage
    })
  }

  const handleSubmitAssessment = async () => {
    if (!session || !selectedProvider) {
      alert('Please select a provider before completing the assessment')
      return
    }

    console.log('Submitting assessment:', { 
      sessionId: session.sessionId,
      providerId: selectedProvider.providerId,
      dealProfile, 
      partyFit, 
      leverageFactors 
    })
    
    calculateLeverage()
    
    // Save assessment data for next phase
    localStorage.setItem(`assessment_${session.sessionId}`, JSON.stringify({
      sessionId: session.sessionId,
      providerId: selectedProvider.providerId,
      providerName: selectedProvider.providerName,
      dealProfile,
      partyFit,
      leverageFactors,
      leverageScore
    }))
    
    setAssessmentComplete(true)
    
    // TODO: Send assessment data to backend via n8n webhook
    // const response = await fetch('https://spikeislandstudios.app.n8n.cloud/webhook/provider-assessmentresults', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ ... })
    // })
    
    alert('Assessment submitted successfully!')
  }

  const phases = [
    { num: 1, name: 'Preliminary', active: true },
    { num: 2, name: 'Foundation', active: false },
    { num: 3, name: 'Gap Narrowing', active: false },
    { num: 4, name: 'Complex Issues', active: false },
    { num: 5, name: 'Commercial', active: false },
    { num: 6, name: 'Final Review', active: false }
  ]

  // ========== SECTION 5: USE EFFECTS ==========
  useEffect(() => {
    const auth = localStorage.getItem('clarence_auth')
    if (!auth) {
      router.push('/auth/login')
      return
    }
    
    // Only load once when component mounts
    loadSessionData()
  }, [router, loadSessionData])

  // ========== SECTION 6: RENDER START ==========
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading assessment...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Session not found</p>
          <button
            onClick={() => router.push('/auth/contracts-dashboard')}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ===== SECTION 7: NAVIGATION ===== */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/auth/contracts-dashboard" className="flex items-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">CLARENCE</div>
                  <div className="text-xs text-gray-500 tracking-widest">THE HONEST BROKER</div>
                </div>
              </Link>
              <span className="ml-4 text-gray-600">Phase 1: Preliminary Assessment</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/auth/contracts-dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </button>
              <button
                onClick={() => router.push(`/chat?sessionId=${session?.sessionId || 'demo'}`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                💬 Chat with CLARENCE
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ===== SECTION 8: MAIN CONTENT CONTAINER ===== */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Contract Header */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white p-6 rounded-xl mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mb-2">Preliminary Assessment</h1>
              <p className="text-blue-100">Session: {session.sessionNumber || session.sessionId.substring(0, 8)}...</p>
              <p className="text-blue-100">Service: {session.serviceRequired}</p>
              <p className="text-blue-100">Deal Value: £{parseInt(session.dealValue || '0').toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-200">Contract Phase</p>
              <p className="text-3xl font-bold">1 of 6</p>
            </div>
          </div>
        </div>

        {/* Provider Selection (if multiple providers) */}
        {providers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">
              {providers.length > 1 
                ? 'Select Provider to Assess' 
                : 'Provider for Assessment'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map(provider => (
                <button
                  key={provider.providerId}
                  onClick={() => {
                    console.log('Provider button clicked:', provider.providerName, provider.providerId)
                    selectProvider(provider)
                  }}
                  className={`p-4 border-2 rounded-lg text-left transition ${
                    selectedProvider?.providerId === provider.providerId
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">{provider.providerName || 'Unknown Provider'}</div>
                  {provider.providerTurnover && (
                    <div className="text-sm text-gray-600">Turnover: {provider.providerTurnover}</div>
                  )}
                  {provider.providerEmployees && (
                    <div className="text-sm text-gray-600">Employees: {provider.providerEmployees}</div>
                  )}
                  <div className="mt-2 text-xs text-blue-600">
                    {selectedProvider?.providerId === provider.providerId
                      ? '✓ Currently Assessing' 
                      : 'Click to Assess'}
                  </div>
                </button>
              ))}
            </div>
            {providers.length > 1 && (
              <p className="mt-4 text-sm text-gray-600">
                Note: Each provider requires separate assessment. You can switch between providers at any time.
              </p>
            )}
          </div>
        )}

        {/* Selected Provider Info */}
        {selectedProvider && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-green-800 font-semibold">Selected Provider: </span>
                <span className="text-green-900">{selectedProvider.providerName}</span>
                {loadingCapabilities && (
                  <span className="ml-2 text-sm text-green-600">Loading capabilities...</span>
                )}
              </div>
              {providers.length > 1 && (
                <button
                  onClick={() => setSelectedProvider(null)}
                  className="text-sm text-green-600 hover:text-green-800"
                >
                  Change Provider
                </button>
              )}
            </div>
          </div>
        )}

        {/* Phase Progress Bar */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            {phases.map((phase) => (
              <div key={phase.num} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold
                  ${phase.active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {phase.num}
                </div>
                <span className="text-xs mt-1">{phase.name}</span>
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '16.66%' }}></div>
          </div>
        </div>

        {/* ===== SECTION 9: ASSESSMENT SECTIONS ===== */}
        {selectedProvider ? (
          <div className="bg-white rounded-xl shadow-sm mb-6">
            <div className="border-b">
              <div className="flex">
                <button
                  onClick={() => setActiveSection('profile')}
                  className={`px-6 py-4 font-semibold border-b-2 transition
                    ${activeSection === 'profile' 
                      ? 'text-blue-600 border-blue-600' 
                      : 'text-gray-600 border-transparent hover:text-gray-900'}`}
                >
                  Deal Profile
                </button>
                <button
                  onClick={() => setActiveSection('fit')}
                  className={`px-6 py-4 font-semibold border-b-2 transition
                    ${activeSection === 'fit' 
                      ? 'text-blue-600 border-blue-600' 
                      : 'text-gray-600 border-transparent hover:text-gray-900'}`}
                >
                  Party Fit
                </button>
                <button
                  onClick={() => setActiveSection('leverage')}
                  className={`px-6 py-4 font-semibold border-b-2 transition
                    ${activeSection === 'leverage' 
                      ? 'text-blue-600 border-blue-600' 
                      : 'text-gray-600 border-transparent hover:text-gray-900'}`}
                >
                  Leverage Assessment
                </button>
              </div>
            </div>

            <div className="p-8">
              {/* Deal Profile Section */}
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Deal Profile</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Services to be Delivered
                    </label>
                    <textarea
                      value={dealProfile.services}
                      onChange={(e) => setDealProfile({...dealProfile, services: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Describe the services..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Delivery Locations (Countries)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., UK, USA, Canada"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => setDealProfile({
                          ...dealProfile, 
                          deliveryLocations: e.target.value.split(',').map(s => s.trim())
                        })}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Service Locations (Countries)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., India, Philippines"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => setDealProfile({
                          ...dealProfile,
                          serviceLocations: e.target.value.split(',').map(s => s.trim())
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Preferred Pricing Approach
                      </label>
                      <select
                        value={dealProfile.pricingApproach}
                        onChange={(e) => setDealProfile({...dealProfile, pricingApproach: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select approach...</option>
                        <option value="per-fte">Per FTE</option>
                        <option value="fixed-price">Fixed Price</option>
                        <option value="time-materials">Time & Materials</option>
                        <option value="outcome-based">Outcome Based</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pricing Expectation
                      </label>
                      <input
                        type="text"
                        value={dealProfile.pricingExpectation}
                        onChange={(e) => setDealProfile({...dealProfile, pricingExpectation: e.target.value})}
                        placeholder="e.g., £50,000 per FTE"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Party Fit Section */}
              {activeSection === 'fit' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Party Fit Assessment</h3>
                  
                  <div className="bg-blue-50 p-4 rounded-lg mb-6">
                    <h4 className="font-semibold text-blue-900 mb-3">Customer Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Company Name"
                        className="px-4 py-2 border rounded-lg"
                        value={partyFit.customerName || session.customerCompany}
                        onChange={(e) => setPartyFit({...partyFit, customerName: e.target.value})}
                      />
                      <input
                        type="text"
                        placeholder="Annual Turnover"
                        className="px-4 py-2 border rounded-lg"
                        value={partyFit.customerTurnover}
                        onChange={(e) => setPartyFit({...partyFit, customerTurnover: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-3">Provider Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Company Name"
                        className="px-4 py-2 border rounded-lg bg-gray-100"
                        value={partyFit.providerName}
                        readOnly
                      />
                      <input
                        type="text"
                        placeholder="Number of Employees"
                        className="px-4 py-2 border rounded-lg"
                        value={partyFit.providerEmployees}
                        onChange={(e) => setPartyFit({...partyFit, providerEmployees: e.target.value})}
                      />
                      <textarea
                        placeholder="Experience with similar services"
                        className="col-span-2 px-4 py-2 border rounded-lg"
                        rows={3}
                        value={partyFit.providerExperience}
                        onChange={(e) => setPartyFit({...partyFit, providerExperience: e.target.value})}
                      />
                    </div>
                    <label className="flex items-center mt-4">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={partyFit.parentGuarantee}
                        onChange={(e) => setPartyFit({...partyFit, parentGuarantee: e.target.checked})}
                      />
                      <span>Willing to provide parent company guarantee</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Leverage Assessment Section */}
              {activeSection === 'leverage' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Leverage Assessment</h3>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Annual Contract Value
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., £2,000,000"
                        className="w-full px-4 py-2 border rounded-lg"
                        value={leverageFactors.dealSize || session.dealValue}
                        onChange={(e) => setLeverageFactors({...leverageFactors, dealSize: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contract Duration (months)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 36"
                        className="w-full px-4 py-2 border rounded-lg"
                        value={leverageFactors.contractDuration}
                        onChange={(e) => setLeverageFactors({...leverageFactors, contractDuration: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="bg-gray-100 p-6 rounded-lg">
                    <h4 className="font-semibold mb-4">Calculated Leverage</h4>
                    <div className="relative h-12 bg-white rounded-full overflow-hidden">
                      <div 
                        className="absolute left-0 top-0 h-full bg-blue-600 flex items-center justify-center text-white font-bold"
                        style={{ width: `${leverageScore.customer}%` }}
                      >
                        Customer {leverageScore.customer}%
                      </div>
                      <div 
                        className="absolute right-0 top-0 h-full bg-gray-600 flex items-center justify-center text-white font-bold"
                        style={{ width: `${leverageScore.provider}%` }}
                      >
                        Provider {leverageScore.provider}%
                      </div>
                    </div>
                    <button
                      onClick={calculateLeverage}
                      className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Recalculate Leverage
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <p className="text-yellow-800 mb-4">Please select a provider to begin the assessment</p>
            {providers.length === 0 && (
              <p className="text-yellow-600 text-sm">No providers found for this session. Please check the session configuration.</p>
            )}
          </div>
        )}

        {/* ===== SECTION 10: ACTION BUTTONS ===== */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="space-y-4">
            {/* Primary Actions */}
            <div className="flex gap-4">
              {!assessmentComplete ? (
                <button
                  onClick={handleSubmitAssessment}
                  disabled={!selectedProvider}
                  className={`px-6 py-3 rounded-lg font-semibold ${
                    selectedProvider
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Complete Assessment
                </button>
              ) : (
                <>
                  <button
                    className="bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold cursor-not-allowed"
                    disabled
                  >
                    ✓ Assessment Complete
                  </button>
                  <button
                    onClick={() => {
                      console.log('Navigating to foundation with:', {
                        sessionId: session.sessionId,
                        providerId: selectedProvider?.providerId
                      })
                      router.push(`/auth/foundation?session=${session.sessionId}&provider=${selectedProvider?.providerId}`)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold animate-pulse"
                  >
                    Proceed to Phase 2: Foundation →
                  </button>
                </>
              )}
            </div>

            {/* Secondary Actions */}
            <div className="flex gap-4">
              <button
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold"
                disabled
              >
                Draft Contract (Coming Soon)
              </button>
              <button
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold"
                disabled
              >
                Progress Report (Coming Soon)
              </button>
            </div>

            {/* Save Action */}
            <div className="flex justify-end">
              <button
                onClick={() => router.push('/auth/contracts-dashboard')}
                className="text-gray-600 hover:text-gray-900 font-semibold"
              >
                Save & Return Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Wrapper component with Suspense boundary
export default function PreliminaryAssessment() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading assessment...</p>
        </div>
      </div>
    }>
      <PreliminaryAssessmentContent />
    </Suspense>
  )
}