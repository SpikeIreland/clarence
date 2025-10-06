'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

/* ========================
   SECTION 0: SAFE HELPERS
   ======================== */

type Json = unknown
type JRec = Record<string, unknown>

const isRecord = (v: unknown): v is JRec =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isArray = (v: unknown): v is unknown[] => Array.isArray(v)

const getRec = (r: JRec, key: string): JRec | undefined => {
  const v = r[key]
  return isRecord(v) ? v : undefined
}
const getArr = (r: JRec, key: string): JRec[] | undefined => {
  const v = r[key]
  return Array.isArray(v) ? (v as JRec[]) : undefined
}
const s = (r: JRec, key: string): string | undefined => {
  const v = r[key]
  return typeof v === 'string' ? v : undefined
}
const toNum = (v: unknown): number | undefined =>
  typeof v === 'number' ? v : undefined

/* =================================
   SECTION 1: DOMAIN INTERFACES
   ================================= */

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

/* Optional shapes we expect from the webhook (loose on purpose) */

interface CapabilityCompany {
  numberOfEmployees?: number
  size?: string
  annualRevenue?: string
  marketShare?: string
  yearsInBusiness?: string
  notableClients?: string
}

interface CapabilityServices {
  primary?: string
  geographicCoverage?: string
}

interface CapabilityCommercial {
  projectMin?: number
  projectMax?: number
  rateMin?: number
  rateMax?: number
}

interface CapabilityOperational {
  geographicCoverage?: string
}

interface CapabilityLeverage {
  customerLeverage?: string
  providerLeverage?: string
  alignmentScore?: string
}

interface CapabilityResponse {
  provider?: {
    company?: string
    name?: string
    industry?: string
    address?: string
  }
  capabilities?: {
    company?: CapabilityCompany
    services?: CapabilityServices
    commercial?: CapabilityCommercial
    operational?: CapabilityOperational
  }
  leverage?: CapabilityLeverage
}

/* =====================================
   SECTION 2: MAIN COMPONENT START
   ===================================== */

function PreliminaryAssessmentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  /* ===============================
     SECTION 3: STATE DECLARATIONS
     =============================== */
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

  /* =========================
     SECTION 4: FUNCTIONS
     ========================= */

  const normalizeCapabilityData = (result: Json): CapabilityResponse | undefined => {
    if (isArray(result) && result.length > 0) {
      const first = result[0]
      if (isRecord(first)) {
        const d = (getRec(first, 'data') ?? first) as JRec
        return d as unknown as CapabilityResponse
      }
      return undefined
    }
    if (isRecord(result)) {
      const dataRec = getRec(result, 'data')
      return (dataRec ?? result) as unknown as CapabilityResponse
    }
    return undefined
  }

  const mapProviderFromRecord = (item: JRec, fallbackId: string, fallbackName = 'Unknown Provider'): Provider => {
    const providerId =
      (s(item, 'providerId') ||
        s(item, 'provider_id') ||
        s(item, 'id') ||
        `provider-${fallbackId}`)!

    const providerName =
      s(item, 'providerName') ||
      s(item, 'provider_name') ||
      s(item, 'name') ||
      s(item, 'providerCompany') ||
      s(item, 'provider_company') ||
      fallbackName

    return {
      providerId,
      providerName,
      providerAddress: s(item, 'providerAddress') || s(item, 'provider_address') || s(item, 'address'),
      providerEntity: s(item, 'providerEntity') || s(item, 'provider_entity') || s(item, 'entity'),
      providerIncorporation:
        s(item, 'providerIncorporation') || s(item, 'provider_incorporation') || s(item, 'incorporation'),
      providerTurnover: s(item, 'providerTurnover') || s(item, 'provider_turnover') || s(item, 'turnover'),
      providerEmployees: s(item, 'providerEmployees') || s(item, 'provider_employees') || s(item, 'employees'),
      providerExperience:
        s(item, 'providerExperience') || s(item, 'provider_experience') || s(item, 'experience')
    }
  }

  const selectProvider = useCallback(
    async (provider: Provider) => {
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
      const currentSessionId =
        session?.sessionId ||
        searchParams.get('session') ||
        (typeof window !== 'undefined' ? localStorage.getItem('currentSessionId') : null)

      console.log('Using sessionId for capabilities:', currentSessionId)
      console.log('Provider ID:', provider.providerId)

      // Load detailed provider capabilities
      if (provider.providerId && currentSessionId) {
        console.log('Loading provider capabilities for:', provider.providerId)
        try {
          const apiUrl = `https://spikeislandstudios.app.n8n.cloud/webhook/provider-capabilities-api?session_id=${encodeURIComponent(
            currentSessionId
          )}&provider_id=${encodeURIComponent(provider.providerId)}`
          console.log('Fetching capabilities from:', apiUrl)

          const response = await fetch(apiUrl)

          if (response.ok) {
            const result: Json = await response.json()
            console.log('Capabilities response:', result)

            const capabilityData = normalizeCapabilityData(result)

            if (capabilityData) {
              // --- Provider basics
              if (capabilityData.provider) {
                const prov = capabilityData.provider
                setPartyFit(prev => ({
                  ...prev,
                  providerName: prov.company ?? prov.name ?? prev.providerName,
                  providerEntity:
                    prov.industry && prov.industry !== 'undefined' ? prov.industry : prev.providerEntity,
                  providerAddress: prov.address || prev.providerAddress
                }))
              }

              // --- Company capabilities
              const company = capabilityData.capabilities?.company
              if (company) {
                setPartyFit(prev => ({
                  ...prev,
                  providerEmployees:
                    toNum(company.numberOfEmployees)?.toString() ??
                    company.size ??
                    prev.providerEmployees,
                  providerTurnover:
                    company.annualRevenue ??
                    (company.marketShare ? `Market: ${company.marketShare}` : prev.providerTurnover) ??
                    prev.providerTurnover,
                  providerExperience: company.yearsInBusiness ?? prev.providerExperience
                }))
                if (company.notableClients) {
                  setPartyFit(prev => ({
                    ...prev,
                    references: [company.notableClients as string]
                  }))
                }
              }

              // --- Leverage
              const lev = capabilityData.leverage
              if (lev) {
                const customerLev = parseInt(lev.customerLeverage ?? '', 10)
                const providerLev = parseInt(lev.providerLeverage ?? '', 10)
                setLeverageScore({
                  customer: Number.isFinite(customerLev) ? customerLev : 50,
                  provider: Number.isFinite(providerLev) ? providerLev : 50
                })

                const align = parseFloat(lev.alignmentScore ?? '')
                if (Number.isFinite(align)) {
                  setLeverageFactors(prev => ({
                    ...prev,
                    partyFitScore: align
                  }))
                }
              }

              // --- Services
              const services = capabilityData.capabilities?.services
              if (services) {
                setDealProfile(prev => ({
                  ...prev,
                  services: services.primary || prev.services || '',
                  serviceLocations: services.geographicCoverage
                    ? services.geographicCoverage.split(',').map(s => s.trim())
                    : prev.serviceLocations
                }))
              }

              // --- Commercials
              const commercial = capabilityData.capabilities?.commercial
              if (commercial) {
                if (
                  typeof commercial.projectMin === 'number' &&
                  typeof commercial.projectMax === 'number'
                ) {
                  const avgValue = (commercial.projectMin + commercial.projectMax) / 2
                  setLeverageFactors(prev => ({
                    ...prev,
                    dealSize: String(avgValue)
                  }))
                }

                if (typeof commercial.rateMin !== 'undefined' && typeof commercial.rateMax !== 'undefined') {
                  setDealProfile(prev => ({
                    ...prev,
                    pricingExpectation: `£${commercial.rateMin} - £${commercial.rateMax} per hour`
                  }))
                }
              }

// --- Operational
const operational = capabilityData.capabilities?.operational
if (operational) {
  const coverage = operational.geographicCoverage ?? ''
  if (coverage) {
    setDealProfile(prev => ({
      ...prev,
      deliveryLocations: coverage.split(',').map(s => s.trim())
    }))
  }
}


              // Persist for reference
              if (typeof window !== 'undefined') {
                localStorage.setItem(
                  `provider_capabilities_${provider.providerId}`,
                  JSON.stringify(capabilityData)
                )
              }
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
    },
    // include `session` fully to satisfy exhaustive-deps; it is stable enough for this usage
    [session, searchParams]
  )

  const loadProviders = useCallback(
    async (sessionId: string, targetProviderId?: string) => {
      try {
        console.log('Loading providers for session:', sessionId, 'targetProviderId:', targetProviderId)

        if (sessionId === 'demo-session') {
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

        const apiUrl = `https://spikeislandstudios.app.n8n.cloud/webhook/session-providers?session=${encodeURIComponent(
          sessionId
        )}`
        console.log('Loading providers from API:', apiUrl)

        const response = await fetch(apiUrl)
        if (response.ok) {
          const data: Json = await response.json()
          console.log('Full providers data received:', data)

          let providersArray: Provider[] = []

          if (isArray(data)) {
            providersArray = (data as unknown[]).flatMap((raw): Provider[] => {
              if (!isRecord(raw)) return []
              return [mapProviderFromRecord(raw, sessionId)]
            })
          } else if (isRecord(data)) {
            const providersInProviders = getArr(data, 'providers')
            const providersInData = getArr(data, 'data')
            const providersInItems = getArr(data, 'items')

            if (providersInProviders) {
              providersArray = providersInProviders
                .filter(isRecord)
                .map((item) => mapProviderFromRecord(item, sessionId))
            } else if (providersInData) {
              providersArray = providersInData
                .filter(isRecord)
                .map((item) => mapProviderFromRecord(item, sessionId))
            } else if (providersInItems) {
              providersArray = providersInItems
                .filter(isRecord)
                .map((item) => mapProviderFromRecord(item, sessionId))
            } else {
              // Maybe it's a single provider-like object
              const looksLikeProvider =
                s(data, 'providerId') ||
                s(data, 'provider_id') ||
                s(data, 'providerName') ||
                s(data, 'provider_name') ||
                s(data, 'id') ||
                s(data, 'name')

              if (looksLikeProvider) {
                providersArray = [mapProviderFromRecord(data, sessionId, 'Provider')]
              } else {
                // Scan for any array that looks like providers
                for (const [, value] of Object.entries(data)) {
                  if (Array.isArray(value) && value.length > 0) {
                    const first = value[0]
                    if (isRecord(first)) {
                      const provish =
                        s(first, 'providerId') ||
                        s(first, 'provider_id') ||
                        s(first, 'providerName') ||
                        s(first, 'provider_name') ||
                        s(first, 'id') ||
                        s(first, 'name')
                      if (provish) {
                        providersArray = (value as unknown[])
                          .filter(isRecord)
                          .map((item) => mapProviderFromRecord(item, sessionId))
                        break
                      }
                    }
                  }
                }
              }
            }
          }

          if (providersArray.length > 0) {
            setProviders(providersArray)

            if (targetProviderId) {
              const targetProvider = providersArray.find(p => p.providerId === targetProviderId)
              if (targetProvider) {
                selectProvider(targetProvider)
              }
            } else if (providersArray.length === 1) {
              selectProvider(providersArray[0])
            }
          } else {
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
          const errorText = await response.text()
          console.error('Error response:', errorText)

          const fallbackProvider: Provider[] = [
            {
              providerId: `provider-${sessionId}-fallback`,
              providerName: session?.providerCompany || 'Selected Provider',
              providerTurnover: 'Not specified',
              providerEmployees: 'Not specified'
            }
          ]
          setProviders(fallbackProvider)
        }
      } catch (error) {
        console.error('Error loading providers:', error)
        const fallbackProvider: Provider[] = [
          {
            providerId: `provider-${sessionId}-error`,
            providerName: session?.providerCompany || 'Available Provider',
            providerTurnover: 'Not specified',
            providerEmployees: 'Not specified'
          }
        ]
        setProviders(fallbackProvider)
      }
    },
    [selectProvider, session]
  )

  const loadSessionData = useCallback(async () => {
    try {
      let sessionId = searchParams.get('session')
      const providerId = searchParams.get('provider')

      // If no session ID in URL, check localStorage
      if (!sessionId) {
        const storedSessionId =
          typeof window !== 'undefined' ? localStorage.getItem('currentSessionId') : null
        const storedSession =
          typeof window !== 'undefined' ? localStorage.getItem('currentSession') : null

        if (storedSessionId && storedSession) {
          const sessionData: Session = JSON.parse(storedSession)
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
        const cachedSession =
          typeof window !== 'undefined' ? localStorage.getItem('currentSession') : null
        if (cachedSession) {
          const sessionData: Session = JSON.parse(cachedSession)
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

      if (providerId) {
        localStorage.setItem('selectedProviderId', providerId)
      }

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

    const numericDealValue = (leverageFactors.dealSize || '').toString().replace(/\D/g, '')
    const dealValue = parseInt(numericDealValue, 10) || 0
    if (dealValue > 5_000_000) customerLeverage += 10
    else if (dealValue > 1_000_000) customerLeverage += 5

    const duration = parseInt(leverageFactors.contractDuration, 10) || 0
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

    calculateLeverage()

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        `assessment_${session.sessionId}`,
        JSON.stringify({
          sessionId: session.sessionId,
          providerId: selectedProvider.providerId,
          providerName: selectedProvider.providerName,
          dealProfile,
          partyFit,
          leverageFactors,
          leverageScore
        })
      )
    }

    setAssessmentComplete(true)
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

  /* ================================
     SECTION 5: USE EFFECTS
     ================================ */
  useEffect(() => {
    const auth = typeof window !== 'undefined' ? localStorage.getItem('clarence_auth') : null
    if (!auth) {
      router.push('/auth/login')
      return
    }
    loadSessionData()
  }, [router, loadSessionData])

  /* ================================
     SECTION 6: RENDER START
     ================================ */
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
              <p className="text-blue-100">
                Session: {(session.sessionNumber || session.sessionId).substring(0, 8)}...
              </p>
              <p className="text-blue-100">Service: {session.serviceRequired}</p>
              <p className="text-blue-100">
                Deal Value: £{parseInt(session.dealValue || '0', 10).toLocaleString()}
              </p>
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
              {providers.length > 1 ? 'Select Provider to Assess' : 'Provider for Assessment'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map(provider => (
                <button
                  key={provider.providerId}
                  onClick={() => selectProvider(provider)}
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
            {phases.map(phase => (
              <div key={phase.num} className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold
                  ${phase.active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                >
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
                    ${activeSection === 'profile' ? 'text-blue-600 border-blue-600' : 'text-gray-600 border-transparent hover:text-gray-900'}`}
                >
                  Deal Profile
                </button>
                <button
                  onClick={() => setActiveSection('fit')}
                  className={`px-6 py-4 font-semibold border-b-2 transition
                    ${activeSection === 'fit' ? 'text-blue-600 border-blue-600' : 'text-gray-600 border-transparent hover:text-gray-900'}`}
                >
                  Party Fit
                </button>
                <button
                  onClick={() => setActiveSection('leverage')}
                  className={`px-6 py-4 font-semibold border-b-2 transition
                    ${activeSection === 'leverage' ? 'text-blue-600 border-blue-600' : 'text-gray-600 border-transparent hover:text-gray-900'}`}
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
                      onChange={e => setDealProfile({ ...dealProfile, services: e.target.value })}
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
                        onChange={e =>
                          setDealProfile({
                            ...dealProfile,
                            deliveryLocations: e.target.value.split(',').map(s => s.trim())
                          })
                        }
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
                        onChange={e =>
                          setDealProfile({
                            ...dealProfile,
                            serviceLocations: e.target.value.split(',').map(s => s.trim())
                          })
                        }
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
                        onChange={e => setDealProfile({ ...dealProfile, pricingApproach: e.target.value })}
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
                        onChange={e => setDealProfile({ ...dealProfile, pricingExpectation: e.target.value })}
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
                        onChange={e => setPartyFit({ ...partyFit, customerName: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Annual Turnover"
                        className="px-4 py-2 border rounded-lg"
                        value={partyFit.customerTurnover}
                        onChange={e => setPartyFit({ ...partyFit, customerTurnover: e.target.value })}
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
                        onChange={e => setPartyFit({ ...partyFit, providerEmployees: e.target.value })}
                      />
                      <textarea
                        placeholder="Experience with similar services"
                        className="col-span-2 px-4 py-2 border rounded-lg"
                        rows={3}
                        value={partyFit.providerExperience}
                        onChange={e => setPartyFit({ ...partyFit, providerExperience: e.target.value })}
                      />
                    </div>
                    <label className="flex items-center mt-4">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={partyFit.parentGuarantee}
                        onChange={e => setPartyFit({ ...partyFit, parentGuarantee: e.target.checked })}
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
                        onChange={e => setLeverageFactors({ ...leverageFactors, dealSize: e.target.value })}
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
                        onChange={e =>
                          setLeverageFactors({ ...leverageFactors, contractDuration: e.target.value })
                        }
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
              <p className="text-yellow-600 text-sm">
                No providers found for this session. Please check the session configuration.
              </p>
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
                      router.push(
                        `/auth/foundation?session=${session.sessionId}&provider=${selectedProvider?.providerId}`
                      )
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

/* ===================================
   Wrapper component with Suspense
   =================================== */
export default function PreliminaryAssessment() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading assessment...</p>
          </div>
        </div>
      }
    >
      <PreliminaryAssessmentContent />
    </Suspense>
  )
}
