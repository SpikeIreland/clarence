// ============================================================================
// PLAYBOOK EXTRACTION — PASS 1: CLAUSE INVENTORY
// Location: n8n-workflows/parse-playbook-prepare-prompt.js
// V6: Two-pass architecture. Pass 1 extracts clause inventory with source
//     quotes and units of measurement. Pass 2 (separate file) extracts
//     positions and range_context anchored to these quotes.
// ============================================================================

const playbookData = $("Get Playbook Metadata").first().json;

// Read extracted text from Validate Input (sent by frontend)
const validateData = $("Validate Input").first().json;
const extractedText = validateData.extractedText || "";

if (!extractedText || extractedText.length < 100) {
  throw new Error(
    "No usable text received from frontend extraction. Length: " +
    (extractedText?.length || 0),
  );
}

// ============================================================================
// PLAYBOOK PERSPECTIVE — customer or provider?
// ============================================================================

const perspective = playbookData.playbook_perspective || "customer";

// ============================================================================
// SMART EXTRACTION: Find and keep sections with negotiation rules
// ============================================================================

const MAX_CHARS = 80000;
const originalLength = extractedText.length;

let processedText = extractedText;
let wasTruncated = false;
let extractionMethod = "full";

if (extractedText.length > MAX_CHARS) {
  wasTruncated = true;

  const importantKeywords = [
    "position", "limit", "threshold", "escalat", "approv", "accept",
    "red line", "redline", "non-negotiable", "mandatory", "must not",
    "minimum", "maximum", "range", "cap", "ceiling", "floor",
    "liability", "indemnit", "warrant", "terminat", "payment",
    "intellectual property", "confidential", "data protection",
    "service level", "sla", "penalty", "breach", "remedy", "insurance",
    "force majeure", "governance", "audit", "preferred", "ideal",
    "fallback", "walk away", "deal breaker", "negotiate", "concession",
    "trade-off", "compromise", "employment", "tupe", "benchmarking",
    "change control", "dispute", "exit", "transition", "subcontract",
    "nda", "mutual", "non-disclosure", "confidentiality period",
    "term", "duration", "survival", "return", "destruction",
  ];

  const sections = extractedText.split(/\n{2,}|\r\n{2,}/);

  const scoredSections = sections.map((section, index) => {
    const lowerSection = section.toLowerCase();
    let score = 0;
    importantKeywords.forEach((keyword) => {
      if (lowerSection.includes(keyword.toLowerCase())) score += 2;
    });
    if (
      /\d+%|\$[\d,]+|£[\d,]+|€[\d,]+|\d+\s*(days|months|years|hours)/i.test(
        section,
      )
    )
      score += 3;
    if (/position\s*[:\-]?\s*\d/i.test(section)) score += 5;
    if (/^[\d\.]+\s+[A-Z]|^[A-Z][a-z]+\s+[A-Z][a-z]+\s*:/m.test(section))
      score += 2;
    if (index < 10) score += 1;
    return { section, score, index };
  });

  const sortedSections = scoredSections
    .filter((s) => s.section.trim().length > 50)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });

  let currentLength = 0;
  const selectedSections = [];

  const introSections = scoredSections.slice(0, 5).map((s) => s.section);
  introSections.forEach((s) => {
    selectedSections.push(s);
    currentLength += s.length;
  });

  for (const item of sortedSections) {
    if (currentLength + item.section.length > MAX_CHARS - 1000) break;
    if (!selectedSections.includes(item.section)) {
      selectedSections.push(item.section);
      currentLength += item.section.length;
    }
  }

  const sectionOrderMap = new Map(scoredSections.map((s, i) => [s.section, i]));
  selectedSections.sort(
    (a, b) => (sectionOrderMap.get(a) || 0) - (sectionOrderMap.get(b) || 0),
  );

  processedText = selectedSections.join("\n\n");
  extractionMethod = "smart_keyword";

  processedText += `\n\n[SMART EXTRACTION: Selected ${selectedSections.length} of ${sections.length} sections based on relevance. Original: ${originalLength} chars, Processed: ${processedText.length} chars]`;
}

// ============================================================================
// PASS 1 PROMPT — Clause Inventory (no positions, no ranges)
// ============================================================================

const systemPrompt = `You are an expert at extracting negotiation rules from corporate contract playbooks.

YOUR TASK (PASS 1 OF 2): Identify EVERY negotiation rule, clause, and policy directive in this playbook. For each one, extract:
1. The clause name and category
2. A VERBATIM quote from the document (the exact text that defines this rule)
3. The correct unit of measurement for THIS specific clause
4. Whether it is a deal breaker or non-negotiable

═══════════════════════════════════════════════════
CRITICAL: SOURCE QUOTES
═══════════════════════════════════════════════════

For each rule, you MUST include a "source_quote" field containing the EXACT text from the playbook document that defines this rule. This quote will be used in Pass 2 to ensure accurate position mapping.

RULES for source_quote:
- Copy the text VERBATIM from the document — do NOT paraphrase, summarise, or invent text
- Include enough context to understand the rule (typically 1-3 sentences, max 150 words)
- If the document says "1-5 years", the quote must say "1-5 years" — not "1-3 years" or "up to 5 years"
- If you cannot find explicit text for a rule, set source_quote to null and mark it as inferred

═══════════════════════════════════════════════════
UNIT OF MEASUREMENT — CRITICAL
═══════════════════════════════════════════════════

Each clause has its OWN unit. Even within the same category, different clauses measure different things:

liability category:
  - "Liability Cap" → % of annual fees
  - "Consequential Loss" → scope (excluded to included)
  - "Indemnity Scope" → scope (narrow to broad)
  - "Indemnity Period" → months

confidentiality category:
  - "Confidentiality Duration" → years
  - "Definition of Confidential Information" → scope (narrow to broad)
  - "Permitted Disclosure" → scope (restricted to broad)
  - "Return/Destruction of Information" → days

termination category:
  - "Notice Period" → months
  - "Termination for Convenience" → scope (restricted to unrestricted)
  - "Cure Period" → days

payment category:
  - "Payment Terms" → days
  - "Late Payment Interest" → % per annum
  - "Invoice Dispute Window" → days

NDA-specific clauses:
  - "NDA Term/Duration" → years
  - "Survival Period" → years after termination
  - "Non-Solicitation Period" → months
  - "Residual Knowledge" → scope (excluded to included)

Do NOT apply a single unit to all clauses in a category. Read each clause individually.

═══════════════════════════════════════════════════
CATEGORIES
═══════════════════════════════════════════════════

Use one of: liability, termination, payment, intellectual_property, confidentiality, data_protection, service_levels, warranties, indemnification, insurance, governance, employment, audit, benchmarking, dispute_resolution, change_control, exit_transition, subcontracting, force_majeure, other

═══════════════════════════════════════════════════
SCHEDULE-SPECIFIC RULES
═══════════════════════════════════════════════════

If the playbook contains rules that specifically apply to a CONTRACT SCHEDULE (appendix/annex), tag them with a "schedule_type" field.

Examples of schedule-specific rules:
- "In the SLA schedule, uptime must be >= 99.5%" → schedule_type: "service_levels"
- "The pricing schedule must include annual indexation cap" → schedule_type: "pricing"
- "Exit period must be at least 6 months" → schedule_type: "exit_transition"
- "DPA must list all sub-processors" → schedule_type: "data_processing"

Valid schedule_type values:
scope_of_work, pricing, service_levels, data_processing, governance, exit_transition, insurance, change_control, disaster_recovery, security, benchmarking, subcontracting, other

Rules in the MAIN BODY of the contract (not specific to any schedule) should have schedule_type: null.

Most rules will be main body rules (schedule_type: null). Only tag rules as schedule-specific when they clearly relate to a particular schedule/appendix section.

═══════════════════════════════════════════════════
VALUE TYPES
═══════════════════════════════════════════════════

Choose the correct value_type for each clause:
- "duration" — time periods (days, months, years)
- "percentage" — percentages of fees, charges, etc.
- "currency" — monetary amounts (GBP, USD, EUR)
- "count" — numeric counts
- "boolean" — yes/no, included/excluded
- "text" — qualitative scope (narrow/broad, restricted/unrestricted)

═══════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════

Return ONLY valid JSON (no markdown backticks):

{
  "playbook_summary": "Brief summary of the playbook (1-2 sentences)",
  "playbook_perspective": "${perspective}",
  "extraction_confidence": 0.85,
  "total_rules_extracted": 45,
  "clause_inventory": [
    {
      "clause_code": "LIA-001",
      "clause_name": "Liability Cap",
      "category": "liability",
      "schedule_type": null,
      "source_quote": "The Provider's aggregate liability under this Agreement shall not exceed 150% of the annual charges paid or payable in the preceding 12-month period.",
      "unit_of_measurement": "% of annual fees",
      "value_type": "percentage",
      "is_deal_breaker": false,
      "is_non_negotiable": false,
      "escalation_trigger": "Below 100% of annual fees",
      "escalation_contact": "Legal Director",
      "requires_approval_below": null,
      "importance_level": 9
    }
  ]
}

═══════════════════════════════════════════════════
COMPLETENESS CHECK
═══════════════════════════════════════════════════

A large corporate playbook may contain 80-150+ rules. If you extract fewer than 30, you have almost certainly missed rules. Count your output and verify completeness.

Number clause_codes sequentially within each category (LIA-001, LIA-002, TERM-001, etc.).`;

const userPrompt = `Identify ALL negotiation rules in this ${perspective === "provider" ? "PROVIDER" : "CUSTOMER"} playbook. This is Pass 1 of 2 — extract the clause inventory with VERBATIM source quotes. Do NOT assign position values yet.

This playbook is written from the ${perspective === "provider" ? "PROVIDER/SUPPLIER" : "CUSTOMER/BUYER"} perspective.

CRITICAL: For each rule's source_quote, copy the EXACT text from the document. If the document says "1-5 years", write "1-5 years" — not "1-3 years" or any other value. Accuracy of quotes is essential for Pass 2.

PLAYBOOK: ${playbookData.playbook_name}
${wasTruncated ? `[Note: Key sections extracted via ${extractionMethod}. Focus on extracting rules from ALL sections provided.]` : ""}

---
${processedText}
---

Extract EVERY rule with accurate source quotes and per-clause units. Count them — aim for completeness. Return ONLY the JSON object.`;

return {
  playbookId: playbookData.playbook_id,
  companyId: playbookData.company_id,
  playbookName: playbookData.playbook_name,
  perspective,
  systemPrompt,
  userPrompt,
  originalLength,
  processedLength: processedText.length,
  wasTruncated,
  extractionMethod,
  // Pass through for Pass 2
  extractedText: processedText,
};
