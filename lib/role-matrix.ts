// ============================================================================
// FILE: lib/role-matrix.ts
// PURPOSE: Role Matrix System - Contract type definitions and role context
// DEPLOY TO: /lib/role-matrix.ts
// ============================================================================
// This file provides:
// 1. Contract type definitions with party labels
// 2. Role context derivation (who is "You" vs "Them")
// 3. Position orientation helpers
// 4. TypeScript interfaces for the Role Matrix system
// ============================================================================


// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

export interface ContractTypeDefinition {
    contractTypeKey: string          // e.g. 'service_agreement'
    contractTypeName: string         // e.g. 'Service Agreement'
    protectedPartyLabel: string      // e.g. 'Customer'  (Position 10 favours them)
    providingPartyLabel: string      // e.g. 'Provider'  (Position 1 favours them)
    protectedPartyDescription: string
    providingPartyDescription: string
    displayOrder: number
    category: 'services' | 'property_finance' | 'sales_distribution' | 'employment_construction' | 'confidentiality'
}

export type PartyRole = 'protected' | 'providing'

export interface RoleContext {
    userPartyRole: PartyRole                // The current user's contract role
    userRoleLabel: string                   // e.g. 'Provider' or 'Customer'
    counterpartyRoleLabel: string           // The other party's label
    positionFavorEnd: 1 | 10               // Which end of the 1-10 scale favours this user
    contractTypeName: string                // e.g. 'Service Agreement'
    protectedPartyLabel: string             // Always the Position 10 party
    providingPartyLabel: string             // Always the Position 1 party
}

export interface RoleSelectionData {
    contractTypeKey: string
    initiatorPartyRole: PartyRole
}


// ============================================================================
// SECTION 2: CONTRACT TYPE DEFINITIONS (FRONTEND MIRROR OF DB)
// ============================================================================
// These mirror the contract_type_roles table for immediate UI rendering
// without requiring a database call. The DB is the source of truth.
// ============================================================================

export const CONTRACT_TYPE_DEFINITIONS: ContractTypeDefinition[] = [
    // Services (most common - shown first)
    {
        contractTypeKey: 'service_agreement',
        contractTypeName: 'Service Agreement',
        protectedPartyLabel: 'Customer',
        providingPartyLabel: 'Provider',
        protectedPartyDescription: 'The party receiving services',
        providingPartyDescription: 'The party delivering services',
        displayOrder: 1,
        category: 'services',
    },
    {
        contractTypeKey: 'saas_agreement',
        contractTypeName: 'SaaS Agreement',
        protectedPartyLabel: 'Subscriber',
        providingPartyLabel: 'Provider',
        protectedPartyDescription: 'The party subscribing to the software service',
        providingPartyDescription: 'The party providing the software service',
        displayOrder: 2,
        category: 'services',
    },
    {
        contractTypeKey: 'it_outsourcing',
        contractTypeName: 'IT Outsourcing Agreement',
        protectedPartyLabel: 'Customer',
        providingPartyLabel: 'Provider',
        protectedPartyDescription: 'The party outsourcing IT operations',
        providingPartyDescription: 'The party delivering IT services',
        displayOrder: 3,
        category: 'services',
    },
    {
        contractTypeKey: 'bpo_agreement',
        contractTypeName: 'BPO Agreement',
        protectedPartyLabel: 'Customer',
        providingPartyLabel: 'Provider',
        protectedPartyDescription: 'The party outsourcing business processes',
        providingPartyDescription: 'The party delivering business process services',
        displayOrder: 4,
        category: 'services',
    },
    {
        contractTypeKey: 'managed_services',
        contractTypeName: 'Managed Services Agreement',
        protectedPartyLabel: 'Customer',
        providingPartyLabel: 'Provider',
        protectedPartyDescription: 'The party receiving managed services',
        providingPartyDescription: 'The party delivering managed services',
        displayOrder: 5,
        category: 'services',
    },
    {
        contractTypeKey: 'consultancy_agreement',
        contractTypeName: 'Consultancy Agreement',
        protectedPartyLabel: 'Client',
        providingPartyLabel: 'Consultant',
        protectedPartyDescription: 'The party receiving consultancy services',
        providingPartyDescription: 'The party providing expert advice',
        displayOrder: 6,
        category: 'services',
    },
    {
        contractTypeKey: 'software_license',
        contractTypeName: 'Software License Agreement',
        protectedPartyLabel: 'Licensee',
        providingPartyLabel: 'Licensor',
        protectedPartyDescription: 'The party licensing the software',
        providingPartyDescription: 'The party granting the software license',
        displayOrder: 7,
        category: 'services',
    },
    {
        contractTypeKey: 'maintenance_agreement',
        contractTypeName: 'Maintenance Agreement',
        protectedPartyLabel: 'Customer',
        providingPartyLabel: 'Service Provider',
        protectedPartyDescription: 'The party receiving maintenance services',
        providingPartyDescription: 'The party delivering maintenance',
        displayOrder: 8,
        category: 'services',
    },

    // Confidentiality
    {
        contractTypeKey: 'nda_one_way',
        contractTypeName: 'NDA (One-Way)',
        protectedPartyLabel: 'Disclosing Party',
        providingPartyLabel: 'Receiving Party',
        protectedPartyDescription: 'The party sharing confidential information',
        providingPartyDescription: 'The party receiving confidential information',
        displayOrder: 9,
        category: 'confidentiality',
    },
    {
        contractTypeKey: 'nda_mutual',
        contractTypeName: 'NDA (Mutual)',
        protectedPartyLabel: 'Party A',
        providingPartyLabel: 'Party B',
        protectedPartyDescription: 'First party in mutual confidentiality agreement',
        providingPartyDescription: 'Second party in mutual confidentiality agreement',
        displayOrder: 10,
        category: 'confidentiality',
    },

    // Property & Finance
    {
        contractTypeKey: 'lease_agreement',
        contractTypeName: 'Lease Agreement',
        protectedPartyLabel: 'Tenant',
        providingPartyLabel: 'Landlord',
        protectedPartyDescription: 'The party leasing the property',
        providingPartyDescription: 'The party providing the property',
        displayOrder: 11,
        category: 'property_finance',
    },
    {
        contractTypeKey: 'loan_agreement',
        contractTypeName: 'Loan Agreement',
        protectedPartyLabel: 'Borrower',
        providingPartyLabel: 'Lender',
        protectedPartyDescription: 'The party receiving the loan',
        providingPartyDescription: 'The party providing the funds',
        displayOrder: 12,
        category: 'property_finance',
    },
    {
        contractTypeKey: 'insurance_policy',
        contractTypeName: 'Insurance Policy',
        protectedPartyLabel: 'Policyholder',
        providingPartyLabel: 'Insurer',
        protectedPartyDescription: 'The party being insured',
        providingPartyDescription: 'The party providing insurance coverage',
        displayOrder: 13,
        category: 'property_finance',
    },

    // Sales & Distribution
    {
        contractTypeKey: 'sales_agreement',
        contractTypeName: 'Sales Agreement',
        protectedPartyLabel: 'Buyer',
        providingPartyLabel: 'Seller',
        protectedPartyDescription: 'The party purchasing goods',
        providingPartyDescription: 'The party selling goods',
        displayOrder: 14,
        category: 'sales_distribution',
    },
    {
        contractTypeKey: 'purchase_agreement',
        contractTypeName: 'Purchase Agreement',
        protectedPartyLabel: 'Buyer',
        providingPartyLabel: 'Seller',
        protectedPartyDescription: 'The party purchasing goods or assets',
        providingPartyDescription: 'The party selling goods or assets',
        displayOrder: 15,
        category: 'sales_distribution',
    },
    {
        contractTypeKey: 'distribution_agreement',
        contractTypeName: 'Distribution Agreement',
        protectedPartyLabel: 'Distributor',
        providingPartyLabel: 'Supplier',
        protectedPartyDescription: 'The party distributing products',
        providingPartyDescription: 'The party supplying products',
        displayOrder: 16,
        category: 'sales_distribution',
    },
    {
        contractTypeKey: 'franchise_agreement',
        contractTypeName: 'Franchise Agreement',
        protectedPartyLabel: 'Franchisee',
        providingPartyLabel: 'Franchisor',
        protectedPartyDescription: 'The party operating the franchise',
        providingPartyDescription: 'The party granting the franchise',
        displayOrder: 17,
        category: 'sales_distribution',
    },

    // Employment & Construction
    {
        contractTypeKey: 'employment_contract',
        contractTypeName: 'Employment Contract',
        protectedPartyLabel: 'Employee',
        providingPartyLabel: 'Employer',
        protectedPartyDescription: 'The party being employed',
        providingPartyDescription: 'The party providing employment',
        displayOrder: 18,
        category: 'employment_construction',
    },
    {
        contractTypeKey: 'construction_contract',
        contractTypeName: 'Construction Contract',
        protectedPartyLabel: 'Client',
        providingPartyLabel: 'Contractor',
        protectedPartyDescription: 'The party commissioning construction',
        providingPartyDescription: 'The party performing construction',
        displayOrder: 19,
        category: 'employment_construction',
    },
    {
        contractTypeKey: 'agency_agreement',
        contractTypeName: 'Agency Agreement',
        protectedPartyLabel: 'Principal',
        providingPartyLabel: 'Agent',
        protectedPartyDescription: 'The party being represented',
        providingPartyDescription: 'The party acting on behalf of the principal',
        displayOrder: 20,
        category: 'employment_construction',
    },
]


// ============================================================================
// SECTION 3: LOOKUP HELPERS
// ============================================================================

/**
 * Find a contract type definition by its key.
 */
export function getContractType(key: string): ContractTypeDefinition | undefined {
    return CONTRACT_TYPE_DEFINITIONS.find(ct => ct.contractTypeKey === key)
}

/**
 * Get all contract types grouped by category for UI rendering.
 */
export function getContractTypesByCategory(): Record<string, ContractTypeDefinition[]> {
    const categories: Record<string, ContractTypeDefinition[]> = {
        services: [],
        confidentiality: [],
        property_finance: [],
        sales_distribution: [],
        employment_construction: [],
    }
    for (const ct of CONTRACT_TYPE_DEFINITIONS) {
        categories[ct.category].push(ct)
    }
    return categories
}

/**
 * Get the display name for a category key.
 */
export function getCategoryDisplayName(category: string): string {
    const names: Record<string, string> = {
        services: 'Services & Technology',
        confidentiality: 'Confidentiality',
        property_finance: 'Property & Finance',
        sales_distribution: 'Sales & Distribution',
        employment_construction: 'Employment & Construction',
    }
    return names[category] || category
}


// ============================================================================
// SECTION 4: ROLE CONTEXT DERIVATION
// ============================================================================

/**
 * Derive the full role context for the current user.
 * 
 * @param contractTypeKey - The contract type (e.g. 'service_agreement')
 * @param initiatorPartyRole - Which role the initiator selected ('protected' or 'providing')
 * @param isInitiator - Whether the current user is the initiator
 * @returns RoleContext with all labels and orientation info
 * 
 * @example
 * // Ventrica (Provider) initiated a Service Agreement
 * const ctx = getRoleContext('service_agreement', 'providing', true)
 * // ctx.userRoleLabel === 'Provider'
 * // ctx.counterpartyRoleLabel === 'Customer'
 * // ctx.positionFavorEnd === 1  (Position 1 favours Provider)
 * 
 * @example
 * // Acme (Customer) is the respondent in that same contract
 * const ctx = getRoleContext('service_agreement', 'providing', false)
 * // ctx.userRoleLabel === 'Customer'
 * // ctx.counterpartyRoleLabel === 'Provider'
 * // ctx.positionFavorEnd === 10  (Position 10 favours Customer)
 */
export function getRoleContext(
    contractTypeKey: string,
    initiatorPartyRole: PartyRole,
    isInitiator: boolean
): RoleContext {
    const contractType = getContractType(contractTypeKey)

    // Fallback for unknown contract types
    if (!contractType) {
        const userRole = isInitiator ? initiatorPartyRole : (initiatorPartyRole === 'protected' ? 'providing' : 'protected')
        return {
            userPartyRole: userRole,
            userRoleLabel: userRole === 'protected' ? 'Party A' : 'Party B',
            counterpartyRoleLabel: userRole === 'protected' ? 'Party B' : 'Party A',
            positionFavorEnd: userRole === 'protected' ? 10 : 1,
            contractTypeName: 'Contract',
            protectedPartyLabel: 'Party A',
            providingPartyLabel: 'Party B',
        }
    }

    // Determine the current user's role
    let userRole: PartyRole
    if (isInitiator) {
        userRole = initiatorPartyRole
    } else {
        // Respondent gets the opposite role
        userRole = initiatorPartyRole === 'protected' ? 'providing' : 'protected'
    }

    // Build context based on role
    if (userRole === 'protected') {
        return {
            userPartyRole: 'protected',
            userRoleLabel: contractType.protectedPartyLabel,
            counterpartyRoleLabel: contractType.providingPartyLabel,
            positionFavorEnd: 10,
            contractTypeName: contractType.contractTypeName,
            protectedPartyLabel: contractType.protectedPartyLabel,
            providingPartyLabel: contractType.providingPartyLabel,
        }
    } else {
        return {
            userPartyRole: 'providing',
            userRoleLabel: contractType.providingPartyLabel,
            counterpartyRoleLabel: contractType.protectedPartyLabel,
            positionFavorEnd: 1,
            contractTypeName: contractType.contractTypeName,
            protectedPartyLabel: contractType.protectedPartyLabel,
            providingPartyLabel: contractType.providingPartyLabel,
        }
    }
}


// ============================================================================
// SECTION 5: POSITION HELPERS
// ============================================================================

/**
 * Get the "Favours You" / "Favours Them" label for a given position.
 */
export function getPositionFavorLabel(
    position: number,
    userPartyRole: PartyRole
): 'favours_you' | 'balanced' | 'favours_them' {
    if (userPartyRole === 'protected') {
        // Protected party is favoured by high positions (7-10)
        if (position >= 7) return 'favours_you'
        if (position <= 3) return 'favours_them'
        return 'balanced'
    } else {
        // Providing party is favoured by low positions (1-3)
        if (position <= 3) return 'favours_you'
        if (position >= 7) return 'favours_them'
        return 'balanced'
    }
}

/**
 * Get colour class for a position based on the fixed scale.
 * Colours are role-neutral (always blue=providing, emerald=protected).
 */
export function getPositionColor(position: number): string {
    if (position <= 3) return 'blue'    // Providing party favoured
    if (position <= 6) return 'amber'   // Balanced range
    return 'emerald'                     // Protected party favoured
}

/**
 * Get descriptive text for a position value.
 */
export function getPositionDescription(
    position: number,
    protectedLabel: string,
    providingLabel: string
): string {
    const descriptions: Record<number, string> = {
        1: `Maximum flexibility for ${providingLabel}`,
        2: `Strong ${providingLabel} terms`,
        3: `${providingLabel}-leaning but reasonable`,
        4: `Slight ${providingLabel} advantage`,
        5: 'Balanced / Market standard',
        6: `Slight ${protectedLabel} advantage`,
        7: `Moderate protection for ${protectedLabel}`,
        8: `Strong protection for ${protectedLabel}`,
        9: `High protection for ${protectedLabel}`,
        10: `Maximum protection for ${protectedLabel}`,
    }
    return descriptions[Math.round(position)] || 'Unknown position'
}