// ============================================================================
// SIGNING CEREMONY — Types & Utilities
// Location: lib/signing.ts
// ============================================================================

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface SigningConfirmation {
    confirmation_id: string
    contract_id: string
    user_id: string
    party_role: 'initiator' | 'respondent'
    entity_name: string
    registration_number: string | null
    jurisdiction: string | null
    registered_address: string | null
    signatory_name: string
    signatory_title: string
    signatory_email: string
    confirmed_at: string
    ip_address: string | null
    user_agent: string | null
}

export interface ContractSignature {
    signature_id: string
    contract_id: string
    document_id: string | null
    confirmation_id: string | null
    user_id: string
    party_role: 'initiator' | 'respondent'
    company_name: string
    signatory_name: string
    signatory_title: string
    signed_at: string
    ip_address: string | null
    user_agent: string | null
    contract_hash: string
    consent_text: string
    status: 'pending' | 'signed' | 'revoked'
}

export type SigningCeremonyStatus =
    | 'awaiting_confirmations'
    | 'awaiting_signatures'
    | 'partially_signed'
    | 'fully_executed'

export interface SigningState {
    initiatorConfirmation: SigningConfirmation | null
    respondentConfirmation: SigningConfirmation | null
    initiatorSignature: ContractSignature | null
    respondentSignature: ContractSignature | null
    contractHash: string | null
    status: SigningCeremonyStatus
    isLoading: boolean
}

export interface EntityConfirmationFormData {
    entityName: string
    registrationNumber: string
    jurisdiction: string
    registeredAddress: string
    signatoryName: string
    signatoryTitle: string
    signatoryEmail: string
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

export const JURISDICTION_OPTIONS = [
    'England & Wales',
    'Scotland',
    'Northern Ireland',
    'Republic of Ireland',
    'United States — Delaware',
    'United States — New York',
    'United States — California',
    'United States — Other',
    'Canada',
    'Australia',
    'Germany',
    'France',
    'Netherlands',
    'Singapore',
    'Hong Kong',
    'United Arab Emirates',
    'Other'
] as const

// ============================================================================
// SECTION 3: UTILITY FUNCTIONS
// ============================================================================

/**
 * Compute SHA-256 hash of a file (PDF) from its URL.
 * Uses the Web Crypto API available in all modern browsers.
 */
export async function hashFileFromUrl(pdfUrl: string): Promise<string> {
    const response = await fetch(pdfUrl)
    if (!response.ok) throw new Error('Could not fetch PDF for hashing')
    const buffer = await response.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate the consent text for the signing ceremony.
 * This exact text is stored alongside the signature for audit purposes.
 */
export function generateConsentText(
    signatoryName: string,
    signatoryTitle: string,
    entityName: string,
    contractHash: string
): string {
    const shortHash = `${contractHash.substring(0, 16)}...${contractHash.substring(contractHash.length - 8)}`
    return `I, ${signatoryName}, ${signatoryTitle} of ${entityName}, confirm that I have reviewed the contract (SHA-256: ${shortHash}) and agree to be bound by its terms. I understand this constitutes a legally binding agreement.`
}

/**
 * Derive the overall signing ceremony status from confirmations and signatures.
 */
export function deriveSigningStatus(
    initiatorConfirmation: SigningConfirmation | null,
    respondentConfirmation: SigningConfirmation | null,
    initiatorSignature: ContractSignature | null,
    respondentSignature: ContractSignature | null
): SigningCeremonyStatus {
    const bothSigned = !!initiatorSignature && !!respondentSignature
    if (bothSigned) return 'fully_executed'

    const oneSigned = !!initiatorSignature || !!respondentSignature
    if (oneSigned) return 'partially_signed'

    const bothConfirmed = !!initiatorConfirmation && !!respondentConfirmation
    if (bothConfirmed) return 'awaiting_signatures'

    return 'awaiting_confirmations'
}

/**
 * Format a hash for display — show first 16 and last 8 characters.
 */
export function formatHash(hash: string): string {
    if (hash.length <= 24) return hash
    return `${hash.substring(0, 16)}...${hash.substring(hash.length - 8)}`
}

/**
 * Validate an email address format.
 */
export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Build the initial form data for entity confirmation,
 * pre-populated from known company and user data.
 */
export function buildInitialFormData(
    companyName: string,
    registrationNumber: string | null,
    jurisdiction: string | null,
    registeredAddress: string | null,
    userFirstName: string,
    userLastName: string,
    userEmail: string
): EntityConfirmationFormData {
    return {
        entityName: companyName || '',
        registrationNumber: registrationNumber || '',
        jurisdiction: jurisdiction || '',
        registeredAddress: registeredAddress || '',
        signatoryName: `${userFirstName || ''} ${userLastName || ''}`.trim(),
        signatoryTitle: '',
        signatoryEmail: userEmail || ''
    }
}
