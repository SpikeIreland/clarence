# Document Centre Redesign: Action Hub + Internal Approvals + Playbook Compliance

## Overview

Transform the Document Centre's centre panel from a passive PDF viewer into an active **Document Action Hub**. Add two new document types: **Internal Approvals** (full email-based approval workflow) and **Playbook Compliance Report** (live data + PDF generation). The left panel stays as the document list; the centre panel becomes the workspace for the selected document.

---

## Phase 1: Centre Panel Refactor (Foundation)

Replace `DocumentPreviewPanel` with `DocumentActionHub`. No database changes — purely UI restructure.

### What changes

**Replace `DocumentPreviewPanel` (currently ~180 lines) with `DocumentActionHub`:**

```
DocumentActionHub
  +-- [no doc selected] → EmptyState (existing placeholder)
  +-- [doc selected]:
      +-- DocumentActionHeader
      |     Document name, status badge, generated date, category badge
      +-- ActionButtonRow
      |     View PDF | Print | Save as PDF | Save as DOCX (disabled) | Share | Request Approval | Generate/Regenerate
      +-- DocumentContentArea
            [generating] → spinner + progress (existing)
            [ready] → inline PDF viewer (iframe, scrollable, below actions) + "Pop out" button
            [in_progress] → static preview (existing DocumentContentPreview)
```

**Action buttons** use existing pill style: `h-8 px-3.5 rounded-full text-xs font-medium` with SVG icons.

| Button | When visible | Behaviour |
|--------|-------------|-----------|
| View PDF | ready + has URL | Toggles inline iframe below actions |
| Print | ready + has URL | Hidden iframe → `contentWindow.print()` |
| Save as PDF | ready + has URL | `<a download>` programmatic click |
| Save as DOCX | always | Disabled, "Coming Soon" tooltip |
| Share | ready | Opens ShareDocumentModal (Phase 3) |
| Request Approval | ready | Opens RequestApprovalModal (Phase 3) |
| Generate | in_progress | Existing `onGenerate()` |
| Regenerate | ready | Existing `onGenerate()`, ghost style |

**Files modified:**
- `app/auth/document-centre/page.tsx` — replace `DocumentPreviewPanel` with `DocumentActionHub`, move generate/download from header into action row

---

## Phase 2: Playbook Compliance Report

Add the Playbook Compliance Report as a new document type with live data rendering in the centre panel + PDF generation capability.

### Database changes
None — uses existing `generated_documents` table with `document_type: 'playbook-compliance'`.

### What changes

**1. Add document type:**
- Add `'playbook-compliance'` to `DocumentId` union type
- Add entry to `DOCUMENT_DEFINITIONS` with shield SVG icon, category `'compliance'`
- Conditionally include in document list when: QC mode + user is initiator + playbook is active (`playbookCompliance.isVisible`)

**2. Centre panel view — `PlaybookComplianceReportView`:**

When selected, the centre panel shows:
- **Summary card**: Large score ring, key metrics (rules checked, passed, failed, red line breaches), playbook name
- **Tab bar**: Red Lines | Categories | Flexibility (reuse existing tab components from `PlaybookComplianceIndicator.tsx`)
- **Generate PDF Report button** (emerald primary) — triggers N8N workflow
- Once PDF exists: standard View/Print/Save/Share actions appear

**3. N8N endpoint:**
- Add `'playbook-compliance'` to `QC_ENDPOINTS` map → `document-qc-playbook-compliance` webhook
- Send pre-computed `ComplianceResult` JSON to N8N (no recalculation needed)
- N8N generates formatted PDF, uploads to Supabase storage, inserts into `generated_documents`

**4. Reuse from `PlaybookComplianceIndicator.tsx`:**
- Export `ScoreRing`, tab content components as named exports
- Import into Document Centre for the compliance report view

**Files modified:**
- `app/auth/document-centre/page.tsx` — new document type, PlaybookComplianceReportView in DocumentActionHub
- `app/components/PlaybookComplianceIndicator.tsx` — export sub-components for reuse

---

## Phase 3: Internal Approvals (Full Email Workflow)

### Database changes

New migration: `supabase/migrations/internal_approvals_tables.sql`

**Table: `internal_approval_requests`**
```
request_id          UUID PK
contract_id         UUID FK → uploaded_contracts
session_id          UUID (for mediation mode)
source_type         TEXT ('quick_contract' | 'mediation')
document_type       TEXT (e.g. 'contract-draft', 'executive-summary')
document_name       TEXT
document_url        TEXT (Supabase storage URL at time of request)
requested_by_user_id UUID
requested_by_name   TEXT
requested_by_email  TEXT
message             TEXT (optional personal note)
priority            TEXT ('normal' | 'high' | 'urgent')
status              TEXT ('pending' | 'approved' | 'rejected' | 'cancelled')
requires_all        BOOLEAN DEFAULT true
created_at          TIMESTAMPTZ
resolved_at         TIMESTAMPTZ
```

**Table: `internal_approval_responses`**
```
response_id         UUID PK
request_id          UUID FK → internal_approval_requests
approver_email      TEXT
approver_name       TEXT
approver_company    TEXT
status              TEXT ('pending' | 'sent' | 'viewed' | 'approved' | 'rejected')
decision_note       TEXT
access_token        TEXT UNIQUE (for email-based access)
sent_at             TIMESTAMPTZ
viewed_at           TIMESTAMPTZ
responded_at        TIMESTAMPTZ
UNIQUE(request_id, approver_email)
```

RLS policies + indexes follow `signing_ceremony_tables.sql` pattern.

### UI Flow

**Step 1 — Selecting "Internal Approvals" in left panel:**
Centre panel shows `InternalApprovalsView`:
- Active approval requests list (cards with document name, status, approver statuses, dates)
- Empty state: "No approval requests yet. Select a generated document and click Request Approval."

**Step 2 — Requesting approval (from any ready document's action row):**
Click "Request Approval" → opens `RequestApprovalModal`:
- Document preview card (name, type, date)
- Approver rows: Name + Email + Company + Remove (reuse recipient input pattern from QC Send page)
- "+ Add Approver" link
- Optional message, priority dropdown
- "Require all approvers" checkbox
- Send Approval Request button

**Step 3 — Backend processing:**
1. Insert `internal_approval_requests` row
2. Insert `internal_approval_responses` rows (one per approver, with unique `access_token`)
3. Send emails via new API route (Resend, same pattern as `send-provider-invite`)
4. Log to `qc_audit_log`

**Step 4 — Approver receives email:**
Link: `/approval/[access_token]` (new public page, no auth required)
- Shows document name, requester info, personal message
- Embedded PDF viewer
- Approve (emerald) / Reject (red border) buttons with optional note
- On submit: updates response row, checks if request is fully resolved

**Step 5 — Requester sees live status:**
Back in Document Centre, the Internal Approvals view loads current state and shows per-approver status badges.

### New files

| File | Purpose |
|------|---------|
| `supabase/migrations/internal_approvals_tables.sql` | DB tables, RLS, indexes |
| `app/approval/[token]/page.tsx` | Public approver page (token-based, no auth) |
| `app/api/email/send-approval-request/route.ts` | Resend email API route |
| `app/api/approval/respond/route.ts` | Approver response API (service role) |

### Files modified
- `app/auth/document-centre/page.tsx` — new document type, InternalApprovalsView, RequestApprovalModal, ShareDocumentModal, approval state management + handlers

---

## Build Order

1. **Phase 1: Centre Panel Refactor** — `DocumentActionHub` replaces `DocumentPreviewPanel`. All existing documents work through the new action hub with View/Print/Save/Generate buttons. No DB changes.

2. **Phase 2: Playbook Compliance Report** — New document type with live compliance data view + PDF generation. Requires N8N workflow setup.

3. **Phase 3: Internal Approvals** — SQL migration → API routes → RequestApprovalModal → InternalApprovalsView → Public approver page → ShareDocumentModal.

4. **Phase 4: Polish** — Audit logging, CLARENCE chat context for new doc types, edge case handling.

---

## Design Decisions

- **Internal Approvals is a "virtual document"** — it appears in the document list but has no generated PDF itself. It is a workflow item. This is a departure from the existing pattern but keeps the three-panel layout clean.
- **Playbook Compliance data flows client→N8N→PDF** — the compliance calculation stays client-side (existing `calculatePlaybookCompliance`). We send the computed result JSON to N8N for PDF formatting, avoiding logic duplication.
- **Token-based approver access** — approvers don't need CLARENCE accounts. Same pattern as QC recipient sharing. Keeps the barrier to entry low for internal stakeholders.
- **PDF viewer stays inline** — below the action buttons in the centre panel, with a "Pop out" button for new tab. Keeps context without losing the ability to view documents.
