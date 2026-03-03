# CLARENCE Signing Ceremony — Implementation Specification

## About This Document

This is a specification for implementing a **Signing Ceremony with Entity Confirmation** feature in the CLARENCE contract negotiation platform. You are working on an existing Next.js/React/TypeScript application with a Supabase PostgreSQL backend.

**Read this entire document before writing any code.**

---

## 1. CONTEXT: What CLARENCE Is

CLARENCE is an AI-powered contract negotiation platform ("The Honest Broker") that mediates between two parties — an **initiator** (customer) and a **respondent** (provider). Contracts are negotiated clause-by-clause in the **Quick Contract Studio**, then committed by both parties. After commitment, both parties land in the **Document Centre** where negotiation documents are generated (Executive Summary, Contract Draft, etc).

The signing ceremony is the final step: both parties formally sign the agreed contract.

---

## 2. THE FEATURE: What We're Building

A signing flow that is **smarter than DocuSign** because CLARENCE already knows who the parties are, what was negotiated, and what was agreed. The key differentiator is an **Entity Confirmation** step before signing begins.

### User Flow

```
CONTRACT COMMITTED
    ↓
STEP 1: ENTITY CONFIRMATION (both parties, independently)
    Each party confirms:
    - Legal entity name (e.g. "Clarence Legal Limited")
    - Company registration number (e.g. "16983899")  
    - Registered jurisdiction (e.g. "England & Wales")
    - Authorised signatory name (e.g. "Paul Smith")
    - Signatory title (e.g. "Legal Director")
    - Signatory email (for routing notification)
    ↓
STEP 2: SIGNING ROUTE
    Once BOTH parties have confirmed entity details:
    - Contract Draft PDF is generated (if not already)
    - Contract hash (SHA-256) is calculated
    - Each signatory receives email notification with signing link
    - Link opens Document Centre with signing modal
    ↓
STEP 3: SIGNING CEREMONY (each party signs independently)
    Signatory reviews:
    - Entity details (confirmed in Step 1)
    - Contract hash (proves document hasn't changed)
    - Consent statement
    Then clicks "Sign" — system records:
    - Timestamp, IP address, user agent
    - Contract hash at time of signing
    - The exact consent text they agreed to
    ↓
STEP 4: EXECUTION
    Once BOTH parties have signed:
    - Contract status updated to "executed"
    - Signing Certificate PDF generated (who, when, where, hash)
    - Contract PDF watermarked "EXECUTED"
    - Both parties notified via email with download links
    - Executed contract appears in both parties' Document Centres
```

---

## 3. TECH STACK

- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Workflows:** N8N (webhook-based, but NOT needed for this feature)
- **Email:** Resend (already configured for CLARENCE notifications)
- **Deployment:** Vercel via GitHub

---

## 4. DATABASE SCHEMA

### 4.1 New Table: `signing_confirmations`

This captures the entity confirmation step (Step 1). Both parties must complete this before signing can begin.

```sql
CREATE TABLE signing_confirmations (
    confirmation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES uploaded_contracts(contract_id),
    user_id UUID NOT NULL,
    party_role TEXT NOT NULL CHECK (party_role IN ('initiator', 'respondent')),
    
    -- Entity details (confirmed by the party)
    entity_name TEXT NOT NULL,
    registration_number TEXT,
    jurisdiction TEXT,
    registered_address TEXT,
    
    -- Signatory details
    signatory_name TEXT NOT NULL,
    signatory_title TEXT NOT NULL,
    signatory_email TEXT NOT NULL,
    
    -- Metadata
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    
    -- Constraints
    UNIQUE(contract_id, party_role)
);

-- RLS: Users can only see confirmations for contracts they're party to
ALTER TABLE signing_confirmations ENABLE ROW LEVEL SECURITY;
```

### 4.2 New Table: `contract_signatures`

This captures the actual signing event (Step 3).

```sql
CREATE TABLE contract_signatures (
    signature_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES uploaded_contracts(contract_id),
    document_id UUID REFERENCES generated_documents(document_id),
    confirmation_id UUID REFERENCES signing_confirmations(confirmation_id),
    user_id UUID NOT NULL,
    party_role TEXT NOT NULL CHECK (party_role IN ('initiator', 'respondent')),
    
    -- From the entity confirmation
    company_name TEXT NOT NULL,
    signatory_name TEXT NOT NULL,
    signatory_title TEXT NOT NULL,
    
    -- Signing evidence
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    contract_hash TEXT NOT NULL,
    consent_text TEXT NOT NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'signed' CHECK (status IN ('pending', 'signed', 'revoked')),
    
    -- Constraints
    UNIQUE(contract_id, party_role)
);

ALTER TABLE contract_signatures ENABLE ROW LEVEL SECURITY;
```

### 4.3 Existing Tables You'll Query

- **`uploaded_contracts`** — contract metadata (contract_id, contract_name, status, company_id, uploaded_by_user_id)
- **`generated_documents`** — generated PDFs (document_id, contract_id, document_type, status, file_path)
- **`qc_recipients`** — respondent party info (contract_id, recipient_email, recipient_name, company_name, user_id)
- **`companies`** — company details (company_id, company_name, registration_number, jurisdiction, registered_address)
- **`users`** or auth data — user profile info

---

## 5. FRONTEND COMPONENTS TO BUILD

All components go in the Document Centre page. The signing feature appears as a **Signing Panel** in the centre panel when the Contract Draft document is selected.

### 5.1 Component: `SigningPanel`

Replaces or augments the document preview when the Contract Draft is selected and the contract is committed. Shows the current signing state and appropriate UI.

**States:**
1. **`awaiting_confirmations`** — Neither or only one party has confirmed entity details
2. **`awaiting_signatures`** — Both confirmed, waiting for signatures
3. **`partially_signed`** — One party has signed
4. **`fully_executed`** — Both parties signed, contract executed

### 5.2 Component: `EntityConfirmationModal`

Modal dialog for Step 1. Pre-populates from known data (company table, user profile) but allows editing.

**Fields:**
- Legal Entity Name (pre-filled from `companies.company_name`)
- Registration Number (pre-filled from `companies.registration_number` if exists)
- Jurisdiction (pre-filled or dropdown: "England & Wales", "Scotland", "United States", etc.)
- Registered Address (pre-filled from `companies.registered_address` if exists)
- Signatory Full Name (pre-filled from user profile)
- Signatory Title (pre-filled from user profile if available)
- Signatory Email (pre-filled from user email, editable — signatory may differ from current user)

**Validation:**
- Entity Name, Signatory Name, Title, and Email are required
- Email must be valid format

**On Submit:**
- Insert into `signing_confirmations`
- Capture IP address and user agent
- Check if other party has also confirmed → if yes, transition to `awaiting_signatures`

### 5.3 Component: `SigningCeremonyModal`

Modal dialog for Step 3. Formal signing ceremony.

**Display:**
- Contract name and type
- Both parties' confirmed entity details (from `signing_confirmations`)
- Contract hash (SHA-256 of the Contract Draft PDF)
- Consent statement: "I, [Signatory Name], [Signatory Title] of [Entity Name], confirm that I have reviewed the contract and agree to be bound by its terms. I understand this constitutes a legally binding agreement."

**On Sign:**
- Insert into `contract_signatures` with hash, IP, user agent, consent text
- Check if other party has also signed → if yes:
  - Update `uploaded_contracts.status` to `'executed'`
  - Log system event
  - Trigger notification to both parties

### 5.4 Component: `SigningProgressTracker`

Visual indicator showing the signing journey progress. Appears in the signing panel.

```
[✓ Confirmed] ——→ [✓ Confirmed] ——→ [ Awaiting ] ——→ [ Awaiting ]
 Initiator          Respondent       Initiator Sign   Respondent Sign
```

Uses emerald (initiator) and blue (respondent) colour coding consistent with CLARENCE branding.

---

## 6. DESIGN GUIDELINES

### Colours (CLARENCE brand)
- **Initiator/Customer:** Emerald (`#10b981`, `bg-emerald-50`, `text-emerald-800`)
- **Respondent/Provider:** Blue (`#3b82f6`, `bg-blue-50`, `text-blue-800`)
- **Executed/Success:** Violet (`#8b5cf6`, `bg-violet-50`) — the "Agree" stage colour
- **Slate palette** for neutrals (`slate-50` through `slate-900`)
- **Signing ceremony** should feel formal — use violet accents for the signing stage

### Typography
- Font: System default (the app uses Tailwind defaults)
- Monospace for hashes and technical details: `font-mono`

### Component Style
- Rounded corners: `rounded-xl` for cards, `rounded-lg` for buttons
- Borders: `border border-slate-200`
- Shadows: `shadow-sm` for subtle elevation
- Buttons: pill-style `rounded-full` for actions (matching recent Document Centre updates)
- All buttons should be `h-8` or `h-9` with `text-xs font-medium`
- Use SVG icons, not emoji

---

## 7. INTEGRATION POINTS

### 7.1 Document Centre Page

The signing feature integrates into the existing Document Centre page (`app/auth/document-centre/page.tsx`).

**Where it appears:** When the user selects the "Contract Draft" document in the left panel AND the contract is committed, the centre panel should show the signing workflow above or instead of the standard document preview.

**Data loading:** On page load, fetch:
- `signing_confirmations` for this contract_id (to know confirmation state)
- `contract_signatures` for this contract_id (to know signing state)

**Party role detection:** The current user's role is determined by:
- If `uploaded_contracts.uploaded_by_user_id === currentUser.userId` → initiator
- If user's ID matches a `qc_recipients.user_id` for this contract → respondent

### 7.2 Email Notifications (via Resend)

The app already uses Resend for email. Send notifications at:
1. When a party confirms entity details → notify the other party
2. When both parties confirm → notify both that signing is ready
3. When a party signs → notify the other party
4. When both sign (execution) → notify both with download links

Use the existing email patterns in the codebase. The Resend integration is in the N8N workflows, but for this feature you can call the Resend API directly from the frontend or via a lightweight API route.

### 7.3 Contract Hash

When generating the contract hash for signing:
1. Fetch the Contract Draft PDF from Supabase Storage
2. Calculate SHA-256 of the PDF bytes
3. Store this hash with the signature record
4. Display the hash (truncated) in the signing ceremony UI

Browser-side SHA-256 example:
```typescript
async function hashFile(fileBuffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
```

---

## 8. STATE MANAGEMENT

The signing state should be managed in the Document Centre component alongside existing state. Add:

```typescript
interface SigningState {
    initiatorConfirmation: SigningConfirmation | null
    respondentConfirmation: SigningConfirmation | null
    initiatorSignature: ContractSignature | null
    respondentSignature: ContractSignature | null
    contractHash: string | null
    status: 'awaiting_confirmations' | 'awaiting_signatures' | 'partially_signed' | 'fully_executed'
    isLoading: boolean
}
```

---

## 9. WHAT NOT TO BUILD

- **No third-party e-signature integration** (DocuSign, etc.) — this is the lightweight internal approach
- **No Signing Certificate PDF generation** — that's a future N8N workflow (6.8)
- **No contract watermarking** — future enhancement
- **No CLM export** — future integration
- **No complex routing rules** — both parties sign independently in any order

---

## 10. FILE STRUCTURE

Create these new files:
```
lib/signing.ts                              — Types, hash utility, consent text generator
app/components/SigningPanel.tsx              — Main signing panel component
app/components/EntityConfirmationModal.tsx   — Entity confirmation modal
app/components/SigningCeremonyModal.tsx      — Signing ceremony modal  
app/components/SigningProgressTracker.tsx    — Visual progress indicator
```

Modify:
```
app/auth/document-centre/page.tsx           — Add signing state, data loading, render SigningPanel
```

Database migration:
```
Create signing_confirmations table
Create contract_signatures table
Add RLS policies for both tables
```

---

## 11. CODING CONVENTIONS

- **Sections:** Wrap code in clearly labeled sections with `// ============` comment blocks
- **Complete replacements:** When modifying existing files, provide complete section replacements rather than scattered line changes
- **Tailwind only:** No inline styles, no CSS modules — Tailwind utility classes only
- **Supabase client:** Import from `@/lib/supabase` using `createClient()`
- **No emoji in code:** Use SVG icons for all UI elements
- **TypeScript strict:** All interfaces explicitly typed, no `any`
- **Error handling:** All Supabase calls wrapped in try/catch with user-facing error messages

---

## 12. IMPLEMENTATION ORDER

Build in this sequence:

1. **Database tables** — Create both tables in Supabase SQL Editor
2. **`lib/signing.ts`** — Types and utilities (no UI dependency)
3. **`SigningProgressTracker`** — Simple visual component (testable in isolation)
4. **`EntityConfirmationModal`** — The confirmation flow
5. **`SigningCeremonyModal`** — The signing flow
6. **`SigningPanel`** — Orchestrator that shows correct state
7. **Document Centre integration** — Wire it all together

---

## 13. ACCEPTANCE CRITERIA

When complete:
- [ ] Initiator can confirm their entity details from the Document Centre
- [ ] Respondent can confirm their entity details from the Document Centre
- [ ] Both parties see the confirmation progress of the other party
- [ ] Once both confirm, the signing ceremony becomes available
- [ ] Each party can sign independently — order doesn't matter
- [ ] Signing captures timestamp, IP, user agent, and contract hash
- [ ] Once both sign, the contract status updates to "executed"
- [ ] The signing panel shows the correct state at every stage
- [ ] Entity details are pre-populated from known data where possible
- [ ] All data is properly isolated (initiator can't see respondent's signing details until both confirm)