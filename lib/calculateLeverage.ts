// =====================================================
// SECTION 2: LEVERAGE CALCULATION ALGORITHM
// Based on CLARENCE Algorithm Technical Specification
// =====================================================

interface LeverageInputs {
    // Market Dynamics (25% weight)
    alternativeProvidersAvailable: number // 1-10
    marketConditions: 'buyers_market' | 'sellers_market' | 'balanced'
    timePressure: number // 1-10
    providerCapacityConstraints: number // 1-10

    // Economic Factors (25% weight)
    dealValue: number
    customerAnnualRevenue?: number
    switchingCosts: number // 1-10
    budgetFlexibility: number // 1-10

    // Strategic Position (25% weight)
    serviceCriticality: number // 1-10
    strategicImportance: number // 1-10
    incumbentAdvantage: 'none' | 'minor' | 'moderate' | 'significant'
    reputationalValue: number // 1-10

    // BATNA Analysis (25% weight)
    customerBatnaQuality: number // 1-10
    providerPipelineStrength: number // 1-10
}

interface LeverageResult {
    customerLeverage: number
    providerLeverage: number
    customerPoints: number
    providerPoints: number
    breakdown: {
        marketDynamics: number
        economicFactors: number
        strategicPosition: number
        batnaAnalysis: number
    }
    factors: {
        market: { score: number; weight: number }
        economic: { score: number; weight: number }
        strategic: { score: number; weight: number }
        batna: { score: number; weight: number }
    }
}

export function calculateLeverage(inputs: LeverageInputs): LeverageResult {

    // =============================================
    // MARKET DYNAMICS SCORE (25% weight)
    // =============================================
    const marketScore = calculateMarketDynamicsScore(
        inputs.alternativeProvidersAvailable,
        inputs.marketConditions,
        inputs.timePressure,
        inputs.providerCapacityConstraints
    )

    // =============================================
    // ECONOMIC FACTORS SCORE (25% weight)
    // =============================================
    const economicScore = calculateEconomicFactorsScore(
        inputs.dealValue,
        inputs.customerAnnualRevenue,
        inputs.switchingCosts,
        inputs.budgetFlexibility
    )

    // =============================================
    // STRATEGIC POSITION SCORE (25% weight)
    // =============================================
    const strategicScore = calculateStrategicPositionScore(
        inputs.serviceCriticality,
        inputs.strategicImportance,
        inputs.incumbentAdvantage,
        inputs.reputationalValue
    )

    // =============================================
    // BATNA ANALYSIS SCORE (25% weight)
    // =============================================
    const batnaScore = calculateBatnaScore(
        inputs.customerBatnaQuality,
        inputs.providerPipelineStrength
    )

    // =============================================
    // CALCULATE OVERALL LEVERAGE RATIO
    // =============================================
    const totalScore = (marketScore + economicScore + strategicScore + batnaScore) / 4

    // Customer leverage = total score (higher = more customer power)
    const customerLeverage = Math.round(totalScore)
    const providerLeverage = 100 - customerLeverage

    // Calculate negotiation points (leverage * 2 per algorithm)
    const customerPoints = customerLeverage * 2
    const providerPoints = providerLeverage * 2

    return {
        customerLeverage,
        providerLeverage,
        customerPoints,
        providerPoints,
        breakdown: {
            marketDynamics: marketScore,
            economicFactors: economicScore,
            strategicPosition: strategicScore,
            batnaAnalysis: batnaScore
        },
        factors: {
            market: { score: marketScore, weight: 25 },
            economic: { score: economicScore, weight: 25 },
            strategic: { score: strategicScore, weight: 25 },
            batna: { score: batnaScore, weight: 25 }
        }
    }
}

// =============================================
// MARKET DYNAMICS CALCULATION
// =============================================
function calculateMarketDynamicsScore(
    alternatives: number,
    marketConditions: string,
    timePressure: number,
    capacityConstraints: number
): number {
    let score = 50 // Base score

    // More alternatives = higher customer leverage
    score += (alternatives - 5) * 5 // Scale: -20 to +25

    // Market conditions adjustment
    if (marketConditions === 'buyers_market') score += 15
    else if (marketConditions === 'sellers_market') score -= 15

    // Time pressure reduces customer leverage
    score -= (timePressure - 5) * 3 // Scale: -15 to +15

    // Provider capacity constraints increase customer leverage
    score += (capacityConstraints - 5) * 2 // Scale: -10 to +10

    return Math.max(0, Math.min(100, score))
}

// =============================================
// ECONOMIC FACTORS CALCULATION
// =============================================
function calculateEconomicFactorsScore(
    dealValue: number,
    customerRevenue: number | undefined,
    switchingCosts: number,
    budgetFlexibility: number
): number {
    let score = 50

    // Deal size relative to customer revenue
    if (customerRevenue && customerRevenue > 0) {
        const ratio = (dealValue / customerRevenue) * 100
        if (ratio < 1) score += 15 // Small deal = high customer leverage
        else if (ratio > 10) score -= 15 // Large deal = low customer leverage
    }

    // Switching costs reduce customer leverage
    score -= (switchingCosts - 5) * 3

    // Budget flexibility increases customer leverage
    score += (budgetFlexibility - 5) * 2

    return Math.max(0, Math.min(100, score))
}

// =============================================
// STRATEGIC POSITION CALCULATION
// =============================================
function calculateStrategicPositionScore(
    serviceCriticality: number,
    strategicImportance: number,
    incumbentAdvantage: string,
    reputationalValue: number
): number {
    let score = 50

    // Service criticality reduces customer leverage
    score -= (serviceCriticality - 5) * 4

    // Strategic importance for provider increases their leverage
    score -= (strategicImportance - 5) * 2

    // Incumbent advantage
    const incumbentMap = {
        'none': 0,
        'minor': -5,
        'moderate': -10,
        'significant': -15
    }
    score += incumbentMap[incumbentAdvantage as keyof typeof incumbentMap] || 0

    // Reputational value for provider
    score -= (reputationalValue - 5) * 2

    return Math.max(0, Math.min(100, score))
}

// =============================================
// BATNA ANALYSIS CALCULATION
// =============================================
function calculateBatnaScore(
    customerBatna: number,
    providerPipeline: number
): number {
    let score = 50

    // Strong customer BATNA increases their leverage
    score += (customerBatna - 5) * 5

    // Strong provider pipeline reduces customer leverage
    score -= (providerPipeline - 5) * 5

    return Math.max(0, Math.min(100, score))
}

// =============================================
// HELPER: CONVERT FORM DATA TO LEVERAGE INPUTS
// =============================================
export function formDataToLeverageInputs(formData: Record<string, unknown>): LeverageInputs {
    // Map form fields to leverage calculation inputs

    // Safely extract values from formData
    const numberOfBidders = String(formData.numberOfBidders || '2-3')
    const marketPosition = String(formData.marketPosition || 'Neutral')
    const decisionTimeline = String(formData.decisionTimeline || 'Normal')
    const serviceCriticality = String(formData.serviceCriticality || 'important')
    const switchingCosts = String(formData.switchingCosts || 'moderate')
    const budgetFlexibility = String(formData.budgetFlexibility || 'moderate')
    const alternativeOptions = String(formData.alternativeOptions || 'some-alternatives')
    const incumbentStatus = String(formData.incumbentStatus || 'no-incumbent')
    const dealValue = String(formData.dealValue || '0')
    const annualRevenue = String(formData.annualRevenue || '')

    const alternativesMap: Record<string, number> = {
        '1': 1,
        '2-3': 4,
        '4-6': 7,
        '7+': 10
    }

    const marketPositionMap: Record<string, 'buyers_market' | 'sellers_market' | 'balanced'> = {
        'Dominant': 'buyers_market',
        'Strong': 'buyers_market',
        'Neutral': 'balanced',
        'Weak': 'sellers_market'
    }

    const timelineMap: Record<string, number> = {
        'Immediate': 10,
        'Fast': 7,
        'Normal': 5,
        'Extended': 2
    }

    const criticalityMap: Record<string, number> = {
        'mission-critical': 10,
        'business-critical': 8,
        'important': 6,
        'standard': 4,
        'non-core': 2
    }

    const switchingCostsMap: Record<string, number> = {
        'minimal': 2,
        'moderate': 5,
        'high': 8,
        'prohibitive': 10
    }

    const flexibilityMap: Record<string, number> = {
        'fixed': 1,
        'limited': 3,
        'moderate': 5,
        'flexible': 7,
        'very-flexible': 10
    }

    const batnaMap: Record<string, number> = {
        'strong-alternatives': 9,
        'some-alternatives': 6,
        'limited-alternatives': 4,
        'no-alternatives': 1,
        'in-house': 7,
        'delay': 5
    }

    // Parse annual revenue
    const parseRevenue = (revenue: string): number => {
        if (!revenue) return 0
        if (revenue.includes('<1M')) return 500000
        if (revenue.includes('1M-10M') || revenue.includes('1-10M')) return 5000000
        if (revenue.includes('10M-50M') || revenue.includes('10-50M')) return 30000000
        if (revenue.includes('50M-100M') || revenue.includes('50-100M')) return 75000000
        if (revenue.includes('100M+')) return 150000000
        return 0
    }

    return {
        alternativeProvidersAvailable: alternativesMap[numberOfBidders] || 4,
        marketConditions: marketPositionMap[marketPosition] || 'balanced',
        timePressure: timelineMap[decisionTimeline] || 5,
        providerCapacityConstraints: 5, // Default - could be enhanced

        dealValue: parseFloat(dealValue.replace(/[^0-9.-]+/g, '') || '0'),
        customerAnnualRevenue: parseRevenue(annualRevenue),
        switchingCosts: switchingCostsMap[switchingCosts] || 5,
        budgetFlexibility: flexibilityMap[budgetFlexibility] || 5,

        serviceCriticality: criticalityMap[serviceCriticality] || 6,
        strategicImportance: 5, // Could be enhanced with more form fields
        incumbentAdvantage: incumbentStatus === 'no-incumbent' ? 'none' : 'minor',
        reputationalValue: 5, // Could be enhanced

        customerBatnaQuality: batnaMap[alternativeOptions] || 5,
        providerPipelineStrength: 5 // Unknown at customer intake stage
    }
}