# Workflow Audit: Pathway & Document Source Matrix

> Scope: Base document usage only (pre-studio / pre-negotiation phase).
> Post-submission and studio-phase workflows (negotiations, chat, etc.) are excluded.

---

## N8N Base URL

- **Primary:** `https://spikeislandstudios.app.n8n.cloud/webhook` (via `NEXT_PUBLIC_N8N_API_BASE`)
- **Alternative:** `https://n8n.clarencetbh.com` (used in `/api/n8n/clarence-qc-context`)

---

## Pathway 1: QC (Quick Contract)

**Entry point:** `app/qc/[token]/page.tsx` (public, no auth)
**Sender setup:** `app/auth/quick-contract/page.tsx`
**Studio:** `app/auth/quick-contract/studio/[contractId]/page.tsx`

The QC pathway is initiated by the sender creating a quick contract, then sending to recipients via a public token link.

| Step | Document Upload | Template |
|------|----------------|----------|
| Parse document | `parse-contract-document` | — (template already has clauses) |
| Send to recipients | `qc-send` | `qc-send` |
| Clause certification | `certify-next-clause` (manual trigger in studio) | — (already certified) |

**Key difference:** Uploading a document triggers `parse-contract-document` to extract and create clause records. A template skips this — the clauses are pre-certified, so `certify-next-clause` is also not needed.

---

## Pathway 2: Contract Create

**Entry point:** `app/auth/create-contract/page.tsx`
**Pathway codes:** `CC-EXISTING`, `CC-MODIFIED`, `CC-UPLOADED`
**Assessment:** `app/auth/strategic-assessment/page.tsx`
**Studio:** `app/auth/contract-studio/page.tsx`

| Step | Document Upload | Template |
|------|----------------|----------|
| Parse document | `parse-contract-document` | — |
| Create session | `session-create` | `session-create` |

**Key difference:** The two branches converge at `session-create`. The upload path adds one extra webhook plus a polling loop waiting for the document to reach `status: 'ready'` before proceeding.

---

## Pathway 3: Co-Create

**Entry point:** `app/auth/create-contract/page.tsx` (same file, `mediationType === 'co_create'`)
**Pathway code:** `CO`
**Assessment:** `app/auth/strategic-assessment/page.tsx` (both parties, in parallel)
**Studio:** `app/auth/co-create-studio/page.tsx`

No document source selection exists — this step is skipped entirely for Co-Create.

| Step | Workflow |
|------|----------|
| Create session | `session-create` |

**Key difference:** Co-Create goes straight to `session-create`, then routes to invite providers before assessment. CLARENCE generates the clause set — no parsing or certification is needed at this stage.

---

## Summary Matrix (Base Document Phase Only)

| Workflow | QC (Upload) | QC (Template) | CC (Upload) | CC (Template) | Co-Create |
|----------|:-----------:|:-------------:|:-----------:|:-------------:|:---------:|
| `parse-contract-document` | Yes | No | Yes | No | No |
| `qc-send` | Yes | Yes | No | No | No |
| `certify-next-clause` | Yes | **No** | No | No | No |
| `session-create` | No | No | Yes | Yes | Yes |

---

## Webhook Payload Reference

### `parse-contract-document`
Called from: `processUpload()` in `app/auth/create-contract/page.tsx`
```json
{
  "file_name": "...",
  "file_type": "pdf|docx|txt",
  "file_size": 12345,
  "raw_text": "...",
  "contract_type": "...",
  "mediation_type": "...",
  "template_source": "uploaded"
}
```
Returns a `contractId` used for polling `uploaded_contracts.status` until `'ready'`.

### `qc-send`
Called when sender dispatches contract to recipients.

### `certify-next-clause`
Called from: QC Studio — user clicks "Certify Clauses" button (manual trigger only).
```json
{
  "contract_id": "...",
  "contract_type_key": "...",
  "initiator_party_role": "...",
  "roleContext": "..."
}
```
Polling: 3-second intervals, max 120 attempts (~6 minutes).

### `session-create`
Called when user reaches the final summary step and clicks "Create".
Includes session context, mediation type, pathway code, and role context.

---

## Notes

- Clause certification (`certify-next-clause`) is **never triggered** when a template is used — the clauses are already certified as part of the template.
- Co-Create has no document source step at all — the entire parse/certify phase is bypassed.
- All three pathways use different database tables: QC uses `quick_contracts`, Contract Create and Co-Create use `sessions`.
- Post-studio workflows (negotiation, chat, strategic assessment processing) are out of scope for this document and will be audited separately.
