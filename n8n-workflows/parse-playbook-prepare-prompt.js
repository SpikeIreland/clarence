// ============================================================================
// SMART PLAYBOOK EXTRACTION - Aligned to actual playbook_rules schema
// V5: Rule count fix, range differentiation, provider perspective support
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
// Determines how positions are interpreted. If the playbook was uploaded by
// a provider company, the positions represent the provider's goals (lower
// numbers = stronger provider position). If customer, higher = stronger.

const perspective = playbookData.playbook_perspective || "customer";

// ============================================================================
// SMART EXTRACTION: Find and keep sections with negotiation rules
// ============================================================================
// Set to 80K: large enough to capture most playbooks in full, while the
// reduced output fields (dropped talking_points, common_objections,
// counter_arguments) keep total response within timeout.

const MAX_CHARS = 80000;
const originalLength = extractedText.length;

let processedText = extractedText;
let wasTruncated = false;
let extractionMethod = "full";

if (extractedText.length > MAX_CHARS) {
  wasTruncated = true;

  const importantKeywords = [
    "position",
    "limit",
    "threshold",
    "escalat",
    "approv",
    "accept",
    "red line",
    "redline",
    "non-negotiable",
    "mandatory",
    "must not",
    "minimum",
    "maximum",
    "range",
    "cap",
    "ceiling",
    "floor",
    "liability",
    "indemnit",
    "warrant",
    "terminat",
    "payment",
    "intellectual property",
    "confidential",
    "data protection",
    "service level",
    "sla",
    "penalty",
    "breach",
    "remedy",
    "insurance",
    "force majeure",
    "governance",
    "audit",
    "preferred",
    "ideal",
    "fallback",
    "walk away",
    "deal breaker",
    "negotiate",
    "concession",
    "trade-off",
    "compromise",
    "employment",
    "tupe",
    "benchmarking",
    "change control",
    "dispute",
    "exit",
    "transition",
    "subcontract",
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
// Build perspective-aware scale definition
// ============================================================================

const scaleDefinition =
  perspective === "provider"
    ? `═══════════════════════════════════════════════════
POSITION SCALE (1-10) — PROVIDER PERSPECTIVE
═══════════════════════════════════════════════════

THIS IS A PROVIDER/SUPPLIER PLAYBOOK. Positions represent what the PROVIDER wants.

Position 1  = Weakest position for this provider (maximum concession to customer)
Position 5  = Balanced / Market standard
Position 10 = Strongest position for this provider (maximum protection for provider)

The scale is oriented so that:
- Higher number = MORE favourable for the PROVIDER (supplier, vendor)
- Lower number  = MORE concession to the CUSTOMER (buyer, tenant)

Example: A provider wanting long payment terms (90 days) would set ideal_position HIGH (8-9).
A provider accepting short payment terms (7 days) would set minimum_position LOW (2-3).`
    : `═══════════════════════════════════════════════════
POSITION SCALE (1-10) — CUSTOMER PERSPECTIVE
═══════════════════════════════════════════════════

THIS IS A CUSTOMER/BUYER PLAYBOOK. Positions represent what the CUSTOMER wants.

Position 1  = Maximum flexibility for the PROVIDING party (supplier, vendor, landlord, licensor)
Position 5  = Balanced / Market standard
Position 10 = Maximum protection for the PROTECTED party (customer, tenant, buyer, licensee)

The scale is oriented so that:
- Higher number = MORE protection for the customer/buyer
- Lower number  = MORE flexibility for the supplier/provider

Example: A customer wanting short payment terms (7 days) would set ideal_position HIGH (8-9).
A customer accepting long payment terms (90 days) would set minimum_position LOW (2-3).`;

// ============================================================================
// PROMPT V5 — Perspective-aware, range-differentiated, output-optimised
// ============================================================================

const systemPrompt = `You are an expert at extracting negotiation rules from corporate contract playbooks.

CRITICAL INSTRUCTION: You MUST extract EVERY negotiation rule, position, red line, escalation trigger, and policy directive from the document. Do NOT summarise, consolidate, or skip rules. A large corporate playbook may contain 80-150+ rules. If you extract fewer than 30, you have almost certainly missed rules.

${scaleDefinition}

═══════════════════════════════════════════════════
FOUR POSITION VALUES PER RULE
═══════════════════════════════════════════════════

- ideal_position: The company's PREFERRED opening position (where they want to start).
- minimum_position: The absolute FLOOR. Below this is unacceptable.
- maximum_position: Best case / aspirational ceiling.
- fallback_position: Compromise if ideal is rejected. Between minimum and ideal.

RULES:
- minimum_position <= fallback_position <= ideal_position <= maximum_position
- All four values MUST be different from each other when the playbook provides enough context.
- Use the FULL 1-10 range. Do not cluster everything around 5-6.

═══════════════════════════════════════════════════
CRITICAL — EVERY RULE MUST HAVE UNIQUE POSITIONS
═══════════════════════════════════════════════════

WRONG — identical positions across rules in a category:
  "Liability Cap":       ideal=8, min=6, max=10, fallback=7
  "Consequential Loss":  ideal=8, min=6, max=10, fallback=7  ← WRONG: copied
  "Indemnity Scope":     ideal=8, min=6, max=10, fallback=7  ← WRONG: copied

RIGHT — each rule reflects its SPECIFIC playbook guidance:
  "Liability Cap":       ideal=8, min=5, max=10, fallback=7  (% of fees — cap at 150%)
  "Consequential Loss":  ideal=9, min=7, max=10, fallback=8  (scope — must exclude)
  "Indemnity Scope":     ideal=7, min=4, max=9,  fallback=6  (scope — IP indemnity only)

Every clause deals with a DIFFERENT aspect — even within the same category. Read the playbook text for EACH clause and assign positions based on what IT says, not what the category says.

Each clause also has its OWN unit of measurement:
- "Liability Cap" → % of fees
- "Consequential Loss" → scope (broad to narrow)
- "Indemnity Period" → months
- "Service Credits" → % of monthly charges
Do NOT apply one measure to all clauses in a section.

═══════════════════════════════════════════════════
CATEGORY MEASURE GUIDE
═══════════════════════════════════════════════════

Use the correct unit for each clause. Override when the clause clearly deals with something different.

liability: % of annual fees (caps), scope (exclusions), months (indemnity periods)
payment: days (terms), % (interest rates), days (dispute windows)
termination: months (notice), scope (rights), days (cure periods)
confidentiality: years (duration), scope (definition breadth)
service_levels: % uptime, % monthly charges (credits), scope (remedies)
insurance: GBP/USD coverage amounts
data_protection: hours (breach notification), scope (audit rights), days (data return)
intellectual_property: years (licence), scope (ownership)

═══════════════════════════════════════════════════
RANGE CONTEXT — REQUIRED FOR EACH RULE
═══════════════════════════════════════════════════

"range_context": {
  "value_type": "duration" | "percentage" | "currency" | "count" | "boolean" | "text",
  "range_unit": "<e.g. '% of annual fees', 'months notice', 'GBP', 'days'>",
  "scale_points": [
    { "position": 1, "label": "<value at pos 1>", "value": <number> },
    { "position": 5, "label": "<value at pos 5>", "value": <number> },
    { "position": 10, "label": "<value at pos 10>", "value": <number> }
  ],
  "source": "parsed"
}

- EXACTLY 3 scale_points: positions 1, 5, and 10.
- Each rule's range_context MUST match THAT rule's unit, not the category default.
- For qualitative clauses, use value_type "text" and descriptive labels.

═══════════════════════════════════════════════════
OTHER FIELDS — KEEP TEXT SHORT (max 12 words)
═══════════════════════════════════════════════════

- clause_code: Short ID (e.g. "LIA-001", "TERM-002")
- clause_name: Specific title (e.g. "Liability Cap", not just "Liability")
- category: One of: liability, termination, payment, intellectual_property, confidentiality, data_protection, service_levels, warranties, indemnification, insurance, governance, employment, audit, benchmarking, dispute_resolution, change_control, exit_transition, subcontracting, force_majeure, other
- rationale: Why this matters (max 12 words)
- negotiation_tips: Key tactic (max 12 words)
- escalation_trigger: What triggers escalation (max 12 words, or null)
- escalation_contact: Role to escalate to (e.g. "Legal Director")
- requires_approval_below: Position needing approval (integer 1-10, or null)
- importance_level: Criticality 1-10
- is_deal_breaker: true if walking away is required when breached
- is_non_negotiable: true if position cannot change at all

═══════════════════════════════════════════════════
QUALITY CHECKS — VERIFY BEFORE RETURNING
═══════════════════════════════════════════════════

1. DIFFERENTIATION: Scan your output. If ANY 2 rules in the same category share the SAME ideal_position AND minimum_position, go back and fix them. Each rule MUST have unique position values.
2. FULL RANGE: Across all rules, positions should span at least 3 to 9.
3. CORRECT MEASURES: Each rule's range_context.range_unit must match THAT clause's unit.
4. POSITION ORDER: minimum <= fallback <= ideal <= maximum for every rule.
5. COMPLETENESS: Count your rules. This playbook may contain 80-150 rules. Extract ALL of them.

IMPORTANT OUTPUT RULES:
1. Number clause_codes sequentially within each category
2. Return ONLY valid JSON, no markdown backticks

{
  "playbook_summary": "...",
  "playbook_perspective": "${perspective}",
  "extraction_confidence": 0.85,
  "total_rules_extracted": 45,
  "rules": [{ ... }]
}`;

const userPrompt = `Extract ALL negotiation rules from this ${perspective === "provider" ? "PROVIDER" : "CUSTOMER"} playbook. Be thorough — extract every rule, red line, position directive, escalation trigger, and approval threshold.

This playbook is written from the ${perspective === "provider" ? "PROVIDER/SUPPLIER" : "CUSTOMER/BUYER"} perspective. Position values should reflect what the ${perspective === "provider" ? "provider" : "customer"} wants.

IMPORTANT: Each clause MUST have its own unique position values and unit of measurement. Do NOT copy positions across clauses in the same category.

PLAYBOOK: ${playbookData.playbook_name}
${wasTruncated ? `[Note: Key sections extracted via ${extractionMethod}. Focus on extracting rules from ALL sections provided.]` : ""}

---
${processedText}
---

Extract EVERY rule with unique positions and per-clause range_context. Count them — aim for completeness. Keep text fields under 12 words. Return ONLY the JSON object.`;

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
};
