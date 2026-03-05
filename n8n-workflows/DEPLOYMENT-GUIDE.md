# Clarence AI Intelligence — Deployment Guide

## What Changed

### Codebase Changes (Ready to Deploy)

#### 1. `app/api/n8n/clarence-chat/route.ts` — v3.0 Unified API Route
- Added `contractTypeKey`, `initiatorPartyRole` to request interface
- Added server-side role context derivation using `getRoleContext()` from `lib/role-matrix.ts`
- Forwards resolved `roleContext` (userRoleLabel, counterpartyRoleLabel, positionFavorEnd) to n8n
- Forwards `contractTypeKey` and `initiatorPartyRole` to context builder
- Supports session-based fields for Chat page and Contract Studio
- Supports dashboard-specific fields

#### 2. `app/auth/quick-contract/studio/[contractId]/page.tsx` — Draft Context Fix
- **Targeted draft** (~line 2214): Now passes viewerRole, viewerUserId, viewerCompanyId, contractTypeKey, initiatorPartyRole
- **Balanced draft** (~line 2412): Same context fields added
- Direction hints now use role-aware labels from `roleContext` instead of hardcoded "Provider"/"Customer"
- Scale descriptions use correct party labels

#### 3. `app/auth/chat/page.tsx` — Routed Through API
- Changed from direct webhook call to `/api/n8n/clarence-chat`
- Passes viewerRole, viewerUserId, sessionId, context type

#### 4. `app/auth/assessment/page.tsx` — Routed Through API
- Changed from direct webhook call to `/api/n8n/clarence-chat`
- Passes session context and assessment-specific fields
- Response handling updated for unified API response format

#### 5. `app/auth/contracts-dashboard/page.tsx` — Routed Through API
- Changed from direct n8n webhook to `/api/n8n/clarence-chat`
- Passes dashboard data and viewer context

### N8N Workflow Changes (Import These)

All workflow JSON files are in the `n8n-workflows/` directory.

#### 1. `clarence-qc-context-builder-v2.json` — Enriched Context Builder
**Key changes from v1:**
- `Fetch Contract Info` SQL now includes `contract_type_key` and `initiator_party_role`
- `Fetch All Clauses` SQL now joins `clause_range_mappings` for position labels (`range_data`, `value_type`, `range_unit`)
- `Fetch Specific Clause` SQL also joins `clause_range_mappings`
- `Assemble` code includes:
  - `viewerAnchoring` section with pre-resolved viewer/other party names
  - `clauseAlignment` percentage (disambiguated from leverage)
  - Position labels passed through to clause highlights
  - Context version tracking (`contextVersion: "2.0"`)

#### 2. `clarence-prompt-builder.json` — NEW Single Source of Truth
**This is the most important workflow.** All Claude-calling workflows should call this.

It implements:
- **Three-point viewer anchoring**: System prompt header, data section YOUR/THEIR prefixes, user prompt footer
- **CLARENCE identity**: Honest Broker personality, core principles
- **Position accuracy rules**: Never invent terms, use range_data labels exactly
- **Alignment terminology**: Clear distinction between clauseAlignment and leverageBalance
- **Legal expertise (Tier 2)**: Commercial law, BPO, GDPR, TUPE, IP, liability knowledge
- **Drafting rules**: Consistency, formal language, position label adherence
- **Contract context**: Full clause data, party chat, activity history, playbook

#### 3. `clarence-qc-chat-v2.json` — Updated QC Chat
**Calls the prompt builder instead of building prompts internally.**
- Validates input and passes to prompt builder
- Uses `temperature=0` on Claude API call
- Formats response for frontend consumption

## Deployment Sequence

### Step 1: Deploy Codebase Changes
```bash
git add app/api/n8n/clarence-chat/route.ts
git add app/auth/quick-contract/studio/[contractId]/page.tsx
git add app/auth/chat/page.tsx
git add app/auth/assessment/page.tsx
git add app/auth/contracts-dashboard/page.tsx
git commit -m "Fix: Unified AI context pipeline with role-aware viewer anchoring"
```
Deploy to Vercel. These changes are backwards-compatible — they will work with both old and new n8n workflows.

### Step 2: Import Prompt Builder Workflow
1. Open n8n → Import Workflow → `clarence-prompt-builder.json`
2. Activate the workflow
3. Test: `POST /webhook/clarence-prompt-builder` with a test payload
4. Verify it returns `systemPrompt` and `userPrompt`

### Step 3: Import Updated Context Builder
1. **Backup** the current `clarence-qc-context-builder` workflow (export as JSON)
2. Import `clarence-qc-context-builder-v2.json`
3. Verify the Postgres credential ID (`ZH5KS5KZA0pid8fg`) matches your environment
4. Activate and test

### Step 4: Import Updated QC Chat
1. **Backup** the current `clarence-qc-chat` workflow
2. Import `clarence-qc-chat-v2.json`
3. **IMPORTANT**: Update the Anthropic API credential ID in the "Claude (temperature=0)" node
4. Verify the prompt builder webhook URL matches your n8n instance
5. Activate and test

### Step 5: Update Remaining Workflows
For `clarence-chat` and `clarence-ai`:
1. Add a "Call Prompt Builder" HTTP Request node (same pattern as QC Chat v2)
2. Replace internal prompt construction with the prompt builder response
3. Set `temperature=0` on the Claude/OpenAI node
4. For `certify-next-clause`: set `temperature=0` only (it has its own prompt logic)

## Testing Checklist

### Test 1: Party Confusion (Critical)
- [ ] Open same QC contract as initiator in Chrome
- [ ] Open same contract as respondent in Firefox/incognito
- [ ] Chat with Clarence from initiator: "What is my position on the liability clause?"
- [ ] Chat with Clarence from respondent: "What is my position on the liability clause?"
- [ ] Verify: Clarence uses "you/your" correctly for each party
- [ ] Verify: Clarence never says "you should consider moving" when the user is already past the middle

### Test 2: Position Labels (Critical)
- [ ] Select a clause with range_data (e.g., payment terms)
- [ ] Ask: "What does my current position mean for this clause?"
- [ ] Verify: Clarence cites exact terms from range_data, not invented values

### Test 3: Draft Consistency
- [ ] Generate balanced draft for same clause 3 times
- [ ] Verify: All 3 are substantially identical

### Test 4: Alignment Terminology
- [ ] Ask: "What is the alignment on this contract?"
- [ ] Verify: Clarence specifies WHICH alignment (clause agreement vs leverage)

### Test 5: Cross-Touchpoint
- [ ] Chat on Chat page → verify context is correct
- [ ] Chat on QC Studio → verify context is correct
- [ ] Chat on Dashboard → verify basic context works

## Credential IDs to Update

When importing workflows, update these credential references to match your n8n environment:

| Workflow | Node | Credential | Current ID |
|---|---|---|---|
| context-builder-v2 | All Postgres nodes | Postgres account | `ZH5KS5KZA0pid8fg` |
| qc-chat-v2 | Claude (temperature=0) | Anthropic API | `REPLACE_WITH_YOUR_ANTHROPIC_CREDENTIAL_ID` |

## Rollback Plan

If issues arise:
1. **Codebase**: The API route changes are backwards-compatible. The old n8n workflows will still work.
2. **N8N**: Re-import the backup JSON files to restore previous workflows.
3. **Quick fix**: If the prompt builder is causing issues, the QC Chat can fall back to its internal prompt construction by bypassing the Call Prompt Builder node.
