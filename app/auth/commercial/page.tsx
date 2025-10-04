'use client'
import { useState, useEffect, useCallback } from 'react'  // Added useCallback
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ========== SECTION 1: INTERFACES ==========
interface SchedulePosition {
  scheduleId: string
  scheduleName: string
  itemName: string
  customerPosition: string | number | boolean
  providerPosition: string | number | boolean
  customerPriority: number
  providerPriority: number
  aligned: boolean
}

// ========== SECTION 2: MAIN COMPONENT START ==========
export default function CommercialTermsPhase() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string>('')
  const [activeSchedule, setActiveSchedule] = useState<'service' | 'charges'>('service')
  const [overallAlignment, setOverallAlignment] = useState(0)

  // ========== SECTION 3: STATE - SCHEDULE POSITIONS ==========
  const [schedulePositions, setSchedulePositions] = useState<SchedulePosition[]>([
    // Service Level Schedule
    {
      scheduleId: 'service-levels',
      scheduleName: 'Service Level Schedule',
      itemName: 'Service Level Requirements',
      customerPosition: 'Critical - 99.9% uptime required',
      providerPosition: 'Standard - 99.5% uptime',
      customerPriority: 9,
      providerPriority: 7,
      aligned: false
    },
    {
      scheduleId: 'service-credits',
      scheduleName: 'Service Level Schedule',
      itemName: 'Service Credits for Failures',
      customerPosition: true,
      providerPosition: false,
      customerPriority: 8,
      providerPriority: 6,
      aligned: false
    },
    {
      scheduleId: 'at-risk-percentage',
      scheduleName: 'Service Level Schedule',
      itemName: 'Maximum At-Risk Percentage',
      customerPosition: 15,
      providerPosition: 5,
      customerPriority: 7,
      providerPriority: 8,
      aligned: false
    },
    // Charges Schedule
    {
      scheduleId: 'pricing-model',
      scheduleName: 'Charges Schedule',
      itemName: 'Preferred Pricing Model',
      customerPosition: 'Monthly FTE',
      providerPosition: 'Price per productive hour',
      customerPriority: 9,
      providerPriority: 9,
      aligned: false
    },
    {
      scheduleId: 'expected-charges',
      scheduleName: 'Charges Schedule',
      itemName: 'Expected Charges',
      customerPosition: '£3,500 per FTE',
      providerPosition: '£4,200 per FTE',
      customerPriority: 10,
      providerPriority: 10,
      aligned: false
    },
    {
      scheduleId: 'cola-adjustment',
      scheduleName: 'Charges Schedule',
      itemName: 'Annual COLA Adjustment',
      customerPosition: 'Yes - capped at 2%',
      providerPosition: 'Yes - based on delivery location',
      customerPriority: 6,
      providerPriority: 7,
      aligned: false
    }
  ])

// ========== SECTION 4: FUNCTIONS (MOVED UP) ==========
const calculateAlignment = useCallback(() => {
  const alignedItems = schedulePositions.filter(s => s.aligned).length
  const totalItems = schedulePositions.length
  const alignment = Math.round((alignedItems / totalItems) * 100)
  setOverallAlignment(alignment)
}, [schedulePositions])

const updatePosition = (scheduleId: string, party: 'customer' | 'provider', value: string | number | boolean) => {
  setSchedulePositions(prev => prev.map(item => {
    if (item.scheduleId === scheduleId) {
      const updated = { ...item }
      if (party === 'customer') {
        updated.customerPosition = value
      } else {
        updated.providerPosition = value
      }
      updated.aligned = updated.customerPosition === updated.providerPosition
      return updated
    }
    return item
  }))
}

const updatePriority = (scheduleId: string, party: 'customer' | 'provider', priority: number) => {
  setSchedulePositions(prev => prev.map(item => {
    if (item.scheduleId === scheduleId) {
      return {
        ...item,
        [party === 'customer' ? 'customerPriority' : 'providerPriority']: priority
      }
    }
    return item
  }))
}

const phases = [
  { num: 1, name: 'Preliminary', status: 'completed' },
  { num: 2, name: 'Foundation', status: 'completed' },
  { num: 3, name: 'Gap Narrowing', status: 'completed' },
  { num: 4, name: 'Complex Issues', status: 'completed' },
  { num: 5, name: 'Commercial', status: 'active' },
  { num: 6, name: 'Final Review', status: 'pending' }
]

// ========== SECTION 5: USE EFFECTS (MOVED DOWN) ==========
useEffect(() => {
  const auth = localStorage.getItem('clarence_auth')
  if (!auth) {
    router.push('/auth/login')
    return
  }

  const urlParams = new URLSearchParams(window.location.search)
  const sessionParam = urlParams.get('session') || localStorage.getItem('currentSessionId') || ''
  setSessionId(sessionParam)
  
  calculateAlignment()
}, [schedulePositions, calculateAlignment, router])

  // ========== SECTION 6: RENDER START ==========
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ===== SECTION 7: NAVIGATION ===== */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/auth/contracts-dashboard" className="flex flex-col">
                <span className="text-2xl font-bold text-blue-600">CLARENCE</span>
                <span className="text-xs text-gray-500">The Honest Broker</span>
              </Link>
              <span className="ml-4 text-gray-600">Phase 5: Commercial Terms</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/auth/contracts-dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </button>
              <button
                onClick={() => router.push(`/chat?sessionId=${sessionId}`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                💬 Chat with CLARENCE
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ===== SECTION 8: MAIN CONTENT ===== */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Contract Header */}
        <div className="bg-gradient-to-r from-purple-800 to-purple-600 text-white p-6 rounded-xl mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mb-2">Commercial Terms & Schedules</h1>
              <p className="text-purple-100">Session: {sessionId.substring(0, 8)}...</p>
              <p className="text-purple-100">Finalizing operational details</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-purple-200">Overall Alignment</p>
              <p className="text-3xl font-bold">{overallAlignment}%</p>
              <p className="text-sm text-purple-200 mt-1">Target: 95%</p>
            </div>
          </div>
        </div>

        {/* Phase Progress */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            {phases.map((phase) => (
              <div key={phase.num} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold
                  ${phase.status === 'completed' ? 'bg-green-600 text-white' : 
                    phase.status === 'active' ? 'bg-purple-600 text-white' : 
                    'bg-gray-200 text-gray-600'}`}>
                  {phase.status === 'completed' ? '✓' : phase.num}
                </div>
                <span className="text-xs mt-1">{phase.name}</span>
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: '83%' }}></div>
          </div>
        </div>

        {/* Schedule Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveSchedule('service')}
                className={`px-6 py-4 font-semibold border-b-2 transition
                  ${activeSchedule === 'service' 
                    ? 'text-purple-600 border-purple-600' 
                    : 'text-gray-600 border-transparent hover:text-gray-900'}`}
              >
                Service Level Schedule
              </button>
              <button
                onClick={() => setActiveSchedule('charges')}
                className={`px-6 py-4 font-semibold border-b-2 transition
                  ${activeSchedule === 'charges' 
                    ? 'text-purple-600 border-purple-600' 
                    : 'text-gray-600 border-transparent hover:text-gray-900'}`}
              >
                Charges Schedule
              </button>
            </div>
          </div>

          {/* Schedule Content */}
          <div className="p-8">
            {activeSchedule === 'service' && (
              <div className="space-y-8">
                <h3 className="text-xl font-bold text-gray-900">Service Level Requirements</h3>
                
                {/* Service Levels */}
                <div className="border rounded-lg p-6 bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-semibold text-lg">What service levels will the provider meet?</h4>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center
                      ${schedulePositions[0].aligned ? 'bg-green-500' : 'bg-red-500'}`}>
                      {schedulePositions[0].aligned ? '✓' : '✗'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h5 className="font-semibold text-blue-900 mb-3">Customer Position</h5>
                      <select 
                        className="w-full px-3 py-2 border rounded-lg mb-4"
                        onChange={(e) => updatePosition('service-levels', 'customer', e.target.value)}
                      >
                        <option>Critical - 99.9% uptime required</option>
                        <option>High - 99.5% uptime required</option>
                        <option>Standard - 99% uptime required</option>
                        <option>Basic - 98% uptime required</option>
                      </select>
                      <label className="text-sm font-medium">Priority (1-10):</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={schedulePositions[0].customerPriority}
                        onChange={(e) => updatePriority('service-levels', 'customer', parseInt(e.target.value))}
                        className="w-full mt-2"
                      />
                      <span className="text-sm font-bold text-blue-600">{schedulePositions[0].customerPriority}</span>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h5 className="font-semibold text-green-900 mb-3">Provider Position</h5>
                      <select 
                        className="w-full px-3 py-2 border rounded-lg mb-4"
                        onChange={(e) => updatePosition('service-levels', 'provider', e.target.value)}
                      >
                        <option>Standard - 99.5% uptime</option>
                        <option>Critical - 99.9% uptime required</option>
                        <option>High - 99.5% uptime required</option>
                        <option>Basic - 98% uptime required</option>
                      </select>
                      <label className="text-sm font-medium">Priority (1-10):</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={schedulePositions[0].providerPriority}
                        onChange={(e) => updatePriority('service-levels', 'provider', parseInt(e.target.value))}
                        className="w-full mt-2"
                      />
                      <span className="text-sm font-bold text-green-600">{schedulePositions[0].providerPriority}</span>
                    </div>
                  </div>
                </div>

                {/* Service Credits */}
                <div className="border rounded-lg p-6 bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-semibold text-lg">Will failures result in service credits?</h4>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center
                      ${schedulePositions[1].aligned ? 'bg-green-500' : 'bg-red-500'}`}>
                      {schedulePositions[1].aligned ? '✓' : '✗'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h5 className="font-semibold text-blue-900 mb-3">Customer Position</h5>
                      <div className="space-y-2 mb-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="customer-credits"
                            checked={schedulePositions[1].customerPosition === true}
                            onChange={() => updatePosition('service-credits', 'customer', true)}
                          />
                          <span className="ml-2">Yes - Service credits apply</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="customer-credits"
                            checked={schedulePositions[1].customerPosition === false}
                            onChange={() => updatePosition('service-credits', 'customer', false)}
                          />
                          <span className="ml-2">No - No service credits</span>
                        </label>
                      </div>
                      <label className="text-sm font-medium">Priority (1-10):</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={schedulePositions[1].customerPriority}
                        onChange={(e) => updatePriority('service-credits', 'customer', parseInt(e.target.value))}
                        className="w-full mt-2"
                      />
                      <span className="text-sm font-bold text-blue-600">{schedulePositions[1].customerPriority}</span>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h5 className="font-semibold text-green-900 mb-3">Provider Position</h5>
                      <div className="space-y-2 mb-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="provider-credits"
                            checked={schedulePositions[1].providerPosition === true}
                            onChange={() => updatePosition('service-credits', 'provider', true)}
                          />
                          <span className="ml-2">Yes - Service credits apply</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="provider-credits"
                            checked={schedulePositions[1].providerPosition === false}
                            onChange={() => updatePosition('service-credits', 'provider', false)}
                          />
                          <span className="ml-2">No - No service credits</span>
                        </label>
                      </div>
                      <label className="text-sm font-medium">Priority (1-10):</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={schedulePositions[1].providerPriority}
                        onChange={(e) => updatePriority('service-credits', 'provider', parseInt(e.target.value))}
                        className="w-full mt-2"
                      />
                      <span className="text-sm font-bold text-green-600">{schedulePositions[1].providerPriority}</span>
                    </div>
                  </div>
                </div>

                {/* At-Risk Percentage */}
<div className="border rounded-lg p-6 bg-gray-50">
  <div className="flex justify-between items-start mb-4">
    <h4 className="font-semibold text-lg">Maximum % of monthly fees at risk?</h4>
    <div className={`w-8 h-8 rounded-full flex items-center justify-center
      ${schedulePositions[2].aligned ? 'bg-green-500' : 'bg-red-500'}`}>
      {schedulePositions[2].aligned ? '✓' : '✗'}
    </div>
  </div>
  
  <div className="grid grid-cols-2 gap-6">
    <div className="bg-blue-50 p-4 rounded-lg">
      <h5 className="font-semibold text-blue-900 mb-3">Customer Position</h5>
      <div className="mb-4">
        <label className="text-sm font-medium">At-Risk Percentage: {schedulePositions[2].customerPosition}%</label>
        <input
          type="range"
          min="5"
          max="20"
          value={typeof schedulePositions[2].customerPosition === 'number' ? schedulePositions[2].customerPosition : 15}  // FIX: Handle type
          onChange={(e) => updatePosition('at-risk-percentage', 'customer', parseInt(e.target.value))}
          className="w-full mt-2"
        />
        <div className="flex justify-between text-xs text-gray-600">
          <span>5%</span>
          <span>20%</span>
        </div>
      </div>
      <label className="text-sm font-medium">Priority (1-10):</label>
      <input
        type="range"
        min="1"
        max="10"
        value={schedulePositions[2].customerPriority}
        onChange={(e) => updatePriority('at-risk-percentage', 'customer', parseInt(e.target.value))}
        className="w-full mt-2"
      />
      <span className="text-sm font-bold text-blue-600">{schedulePositions[2].customerPriority}</span>
    </div>
    
    <div className="bg-green-50 p-4 rounded-lg">
      <h5 className="font-semibold text-green-900 mb-3">Provider Position</h5>
      <div className="mb-4">
        <label className="text-sm font-medium">At-Risk Percentage: {schedulePositions[2].providerPosition}%</label>
        <input
          type="range"
          min="5"
          max="20"
          value={typeof schedulePositions[2].providerPosition === 'number' ? schedulePositions[2].providerPosition : 5}  // FIX: Handle type
          onChange={(e) => updatePosition('at-risk-percentage', 'provider', parseInt(e.target.value))}
          className="w-full mt-2"
        />
        <div className="flex justify-between text-xs text-gray-600">
          <span>5%</span>
          <span>20%</span>
        </div>
      </div>
      <label className="text-sm font-medium">Priority (1-10):</label>
      <input
        type="range"
        min="1"
        max="10"
        value={schedulePositions[2].providerPriority}
        onChange={(e) => updatePriority('at-risk-percentage', 'provider', parseInt(e.target.value))}
        className="w-full mt-2"
      />
      <span className="text-sm font-bold text-green-600">{schedulePositions[2].providerPriority}</span>
    </div>
  </div>
</div>
              </div>
            )}

            {activeSchedule === 'charges' && (
              <div className="space-y-8">
                <h3 className="text-xl font-bold text-gray-900">Charges & Pricing Schedule</h3>
                
                {/* Pricing Model */}
                <div className="border rounded-lg p-6 bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-semibold text-lg">Preferred Pricing Model</h4>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center
                      ${schedulePositions[3].aligned ? 'bg-green-500' : 'bg-red-500'}`}>
                      {schedulePositions[3].aligned ? '✓' : '✗'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h5 className="font-semibold text-blue-900 mb-3">Customer Position</h5>
                      <select 
                        className="w-full px-3 py-2 border rounded-lg mb-4"
                        onChange={(e) => updatePosition('pricing-model', 'customer', e.target.value)}
                      >
                        <option>Monthly FTE</option>
                        <option>Price per productive hour</option>
                        <option>Fixed monthly fee</option>
                        <option>Transaction-based pricing</option>
                      </select>
                      <label className="text-sm font-medium">Priority (1-10):</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={schedulePositions[3].customerPriority}
                        onChange={(e) => updatePriority('pricing-model', 'customer', parseInt(e.target.value))}
                        className="w-full mt-2"
                      />
                      <span className="text-sm font-bold text-blue-600">{schedulePositions[3].customerPriority}</span>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h5 className="font-semibold text-green-900 mb-3">Provider Position</h5>
                      <select 
                        className="w-full px-3 py-2 border rounded-lg mb-4"
                        onChange={(e) => updatePosition('pricing-model', 'provider', e.target.value)}
                      >
                        <option>Price per productive hour</option>
                        <option>Monthly FTE</option>
                        <option>Fixed monthly fee</option>
                        <option>Transaction-based pricing</option>
                      </select>
                      <label className="text-sm font-medium">Priority (1-10):</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={schedulePositions[3].providerPriority}
                        onChange={(e) => updatePriority('pricing-model', 'provider', parseInt(e.target.value))}
                        className="w-full mt-2"
                      />
                      <span className="text-sm font-bold text-green-600">{schedulePositions[3].providerPriority}</span>
                    </div>
                  </div>
                </div>

                {/* Expected Charges */}
<div className="border rounded-lg p-6 bg-gray-50">
  <div className="flex justify-between items-start mb-4">
    <h4 className="font-semibold text-lg">Expected Charges</h4>
    <div className={`w-8 h-8 rounded-full flex items-center justify-center
      ${schedulePositions[4].aligned ? 'bg-green-500' : 'bg-red-500'}`}>
      {schedulePositions[4].aligned ? '✓' : '✗'}
    </div>
  </div>
  
  <div className="grid grid-cols-2 gap-6">
    <div className="bg-blue-50 p-4 rounded-lg">
      <h5 className="font-semibold text-blue-900 mb-3">Customer Position</h5>
      <input
        type="text"
        className="w-full px-3 py-2 border rounded-lg mb-4"
        placeholder="e.g., £3,500 per FTE"
        value={typeof schedulePositions[4].customerPosition === 'string' ? schedulePositions[4].customerPosition : ''}  // FIX: Ensure string
        onChange={(e) => updatePosition('expected-charges', 'customer', e.target.value)}
      />
      <label className="text-sm font-medium">Priority (1-10):</label>
      <input
        type="range"
        min="1"
        max="10"
        value={schedulePositions[4].customerPriority}
        onChange={(e) => updatePriority('expected-charges', 'customer', parseInt(e.target.value))}
        className="w-full mt-2"
      />
      <span className="text-sm font-bold text-blue-600">{schedulePositions[4].customerPriority}</span>
    </div>
    
    <div className="bg-green-50 p-4 rounded-lg">
      <h5 className="font-semibold text-green-900 mb-3">Provider Position</h5>
      <input
        type="text"
        className="w-full px-3 py-2 border rounded-lg mb-4"
        placeholder="e.g., £4,200 per FTE"
        value={typeof schedulePositions[4].providerPosition === 'string' ? schedulePositions[4].providerPosition : ''}  // FIX: Ensure string
        onChange={(e) => updatePosition('expected-charges', 'provider', e.target.value)}
      />
      <label className="text-sm font-medium">Priority (1-10):</label>
      <input
        type="range"
        min="1"
        max="10"
        value={schedulePositions[4].providerPriority}
        onChange={(e) => updatePriority('expected-charges', 'provider', parseInt(e.target.value))}
        className="w-full mt-2"
      />
      <span className="text-sm font-bold text-green-600">{schedulePositions[4].providerPriority}</span>
    </div>
  </div>
</div>

                {/* COLA Adjustment */}
                <div className="border rounded-lg p-6 bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-semibold text-lg">Annual Cost of Living Adjustment (COLA)</h4>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center
                      ${schedulePositions[5].aligned ? 'bg-green-500' : 'bg-red-500'}`}>
                      {schedulePositions[5].aligned ? '✓' : '✗'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h5 className="font-semibold text-blue-900 mb-3">Customer Position</h5>
                      <select 
                        className="w-full px-3 py-2 border rounded-lg mb-4"
                        onChange={(e) => updatePosition('cola-adjustment', 'customer', e.target.value)}
                      >
                        <option>Yes - capped at 2%</option>
                        <option>Yes - based on delivery location</option>
                        <option>Yes - capped at 4%</option>
                        <option>No COLA (prices fixed)</option>
                      </select>
                      <label className="text-sm font-medium">Priority (1-10):</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={schedulePositions[5].customerPriority}
                        onChange={(e) => updatePriority('cola-adjustment', 'customer', parseInt(e.target.value))}
                        className="w-full mt-2"
                      />
                      <span className="text-sm font-bold text-blue-600">{schedulePositions[5].customerPriority}</span>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h5 className="font-semibold text-green-900 mb-3">Provider Position</h5>
                      <select 
                        className="w-full px-3 py-2 border rounded-lg mb-4"
                        onChange={(e) => updatePosition('cola-adjustment', 'provider', e.target.value)}
                      >
                        <option>Yes - based on delivery location</option>
                        <option>Yes - capped at 4%</option>
                        <option>Yes - capped at 2%</option>
                        <option>No COLA (prices fixed)</option>
                      </select>
                      <label className="text-sm font-medium">Priority (1-10):</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={schedulePositions[5].providerPriority}
                        onChange={(e) => updatePriority('cola-adjustment', 'provider', parseInt(e.target.value))}
                        className="w-full mt-2"
                      />
                      <span className="text-sm font-bold text-green-600">{schedulePositions[5].providerPriority}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== SECTION 9: ACTION BUTTONS ===== */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <p>Aligned Items: {schedulePositions.filter(s => s.aligned).length} of {schedulePositions.length}</p>
              <p>Ready to proceed when alignment reaches 95%</p>
            </div>
            <div className="flex gap-4">
              <button
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Generate Final Schedules
              </button>
              <button
                className={`px-6 py-3 rounded-lg font-semibold
                  ${overallAlignment >= 95 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                disabled={overallAlignment < 95}
              >
                Proceed to Phase 6: Final Review
              </button>
            </div>
          </div>
        </div>
        {/* ===== END SECTION 9 ===== */}

      </div> {/* Closes main content - SECTION 8 */}
    </div> /* Closes min-h-screen - SECTION 6 */
  ) /* Closes return - SECTION 6 */
} /* Closes component - SECTION 2 */