// ============================================================================
// SMART PLAYBOOK EXTRACTION - Aligned to actual playbook_rules schema
// V3: Position accuracy, per-clause measures, range_context output
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
// SMART EXTRACTION: Find and keep sections with negotiation rules
// ============================================================================

const MAX_CHARS = 200000;
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
// PROMPT V3 - Per-clause measures, range_context, position accuracy
// ============================================================================

const systemPrompt = `You are an expert at extracting negotiation rules from corporate contract playbooks.

CRITICAL INSTRUCTION: You MUST extract EVERY negotiation rule, position, red line, escalation trigger, and policy directive from the document. Do NOT summarise, consolidate, or skip rules. A typical corporate playbook contains 30-80+ rules. If you extract fewer than 20, you have almost certainly missed rules.

═══════════════════════════════════════════════════
POSITION SCALE (1-10) — FIXED DEFINITION
═══════════════════════════════════════════════════

Position 1  = Maximum flexibility for the PROVIDING party (supplier, vendor, landlord, licensor)
Position 5  = Balanced / Market standard
Position 10 = Maximum protection for the PROTECTED party (customer, tenant, buyer, licensee)

The scale is ALWAYS oriented so that:
- Higher number = MORE protection for the customer/buyer
- Lower number  = MORE flexibility for the supplier/provider

═══════════════════════════════════════════════════
FOUR POSITION VALUES PER RULE
═══════════════════════════════════════════════════

- ideal_position: The company's PREFERRED opening position (where they want to start).
- minimum_position: The absolute FLOOR. Below this is unacceptable.
- maximum_position: Best case / aspirational ceiling.
- fallback_position: Compromise if ideal is rejected. Between minimum and ideal.

RULES:
- minimum_position <= fallback_position <= ideal_position <= maximum_position
- All four values MUST be different from each other when the playbook provides enough context. Identical values across all four fields signals lazy extraction.
- Use the FULL 1-10 range. Do not cluster everything around 5-6.

═══════════════════════════════════════════════════
CRITICAL — ANALYSE EACH CLAUSE INDIVIDUALLY
═══════════════════════════════════════════════════

Every clause MUST be treated as a SEPARATE rule with its OWN:
- Position values (do NOT copy the same numbers across clauses)
- Unit of measurement (do NOT apply one measure to all clauses in a section)
- Rationale (do NOT use generic reasoning)

A single category (e.g. "Liability") often contains clauses measured in DIFFERENT units:
- "Liability Cap" → measured in % of fees
- "Consequential Loss Exclusion" → measured as scope (broad to narrow), NOT %
- "Indemnity Period" → measured in months
- "Service Credits" → measured in % of monthly charges

You MUST assign the correct measure to EACH individual clause.

═══════════════════════════════════════════════════
CATEGORY MEASURE GUIDE
═══════════════════════════════════════════════════

Use the correct unit for each clause. These are TYPICAL defaults — override when the clause clearly deals with something different.

liability:
  Default: % of annual fees. Pos 1 ≈ 50% | Pos 5 ≈ 150% | Pos 10 ≈ Unlimited
  Exclusion clauses: scope (broad→narrow). Do NOT use % for exclusions.
  Indemnity clauses: may use months, currency amounts, or scope.

payment:
  Default: days (payment terms). Pos 1 ≈ 90 days | Pos 5 ≈ 30 days | Pos 10 ≈ 7 days
  Late payment: may use % interest rate.
  Invoicing disputes: may use days (resolution window).

termination:
  Default: months (notice period). Pos 1 ≈ 1 month | Pos 5 ≈ 6 months | Pos 10 ≈ 24 months
  Termination rights: scope (limited→broad). Pos 1 = limited, Pos 10 = broad customer rights.
  Cure periods: days.

confidentiality:
  Default: years (obligation duration). Pos 1 ≈ 1 year | Pos 5 ≈ 3 years | Pos 10 ≈ Perpetual
  Scope clauses: breadth of definition (narrow→broad).

service_levels:
  Default: % uptime. Pos 1 ≈ 95% | Pos 5 ≈ 99.5% | Pos 10 ≈ 99.99%
  Service credits: % of monthly charges.
  Remedies/step-in rights: scope (none→full).

insurance:
  Default: GBP coverage. Pos 1 ≈ £500K | Pos 5 ≈ £2M | Pos 10 ≈ £10M
  Different policy types may have different amounts.

data_protection:
  Default: hours (breach notification). Pos 1 ≈ No SLA | Pos 5 ≈ 48 hrs | Pos 10 ≈ 4 hrs
  Audit rights: scope. Data return: days (post-termination).

intellectual_property:
  Default: years (retention/licence). Pos 1 ≈ 0 years | Pos 5 ≈ 3 years | Pos 10 ≈ Perpetual
  Ownership clauses: scope. Pos 1 = provider owns all, Pos 10 = customer owns deliverables.

═══════════════════════════════════════════════════
RANGE CONTEXT — REQUIRED FOR EACH RULE
═══════════════════════════════════════════════════

For each rule, output a range_context object mapping the 1-10 scale to real-world values for THAT specific clause:

"range_context": {
  "value_type": "duration" | "percentage" | "currency" | "count" | "boolean" | "text",
  "range_unit": "<e.g. '% of annual fees', 'months notice', 'GBP', 'days'>",
  "scale_points": [
    { "position": 1, "label": "<e.g. 50%>", "value": <number> },
    { "position": 5, "label": "<e.g. 150%>", "value": <number> },
    { "position": 10, "label": "<e.g. Unlimited>", "value": 999 }
  ],
  "source": "parsed"
}

Rules:
- Provide 3-5 scale_points covering at minimum positions 1, 5, and 10.
- If the playbook states exact values, use those. Otherwise use industry defaults.
- For qualitative clauses (scope, rights), use value_type "text" and descriptive labels.
- Always set source to "parsed".

═══════════════════════════════════════════════════
OTHER FIELDS
═══════════════════════════════════════════════════

For each rule (keep text fields to 1-2 sentences max):
- clause_code: Short identifier (e.g. "LIA-001", "TERM-002", "INS-003")
- clause_name: Specific clause title (e.g. "Liability Cap", not just "Liability")
- category: One of: liability, termination, payment, intellectual_property, confidentiality, data_protection, service_levels, warranties, indemnification, insurance, governance, employment, audit, benchmarking, dispute_resolution, change_control, exit_transition, subcontracting, force_majeure, other
- rationale: Why this matters (1 sentence, from the playbook — not invented)
- negotiation_tips: Key tactic (1 sentence)
- talking_points: Main argument (1 sentence)
- common_objections: Typical counterparty pushback (1 sentence)
- counter_arguments: Response to objections (1 sentence)
- escalation_trigger: What triggers escalation (1 sentence, or null)
- escalation_contact: Role to escalate to (e.g. "Group Legal Director")
- requires_approval_below: Position requiring approval (integer 1-10, or null)
- importance_level: Criticality 1-10 (10=most critical)
- is_deal_breaker: true if walking away is required when breached
- is_non_negotiable: true if position cannot change at all

═══════════════════════════════════════════════════
QUALITY CHECKS — VERIFY BEFORE RETURNING
═══════════════════════════════════════════════════

1. DIFFERENTIATION: If 3+ rules in the same category share identical ideal_position values, re-read each clause and differentiate.
2. FULL RANGE: Across all rules, positions should span at least 3 to 8. If everything clusters at 5-6, you are not reading carefully.
3. CORRECT MEASURES: Each rule's range_context must use the unit appropriate to THAT clause, not the generic category default.
4. POSITION ORDER: minimum <= fallback <= ideal <= maximum for every rule.
5. RATIONALE: Extract reasoning from the playbook. If not stated, write "Not specified in playbook".
6. COMPLETENESS: Count your rules. A comprehensive playbook typically yields 30-80. Fewer than 20 means you missed rules.

IMPORTANT OUTPUT RULES:
1. Number clause_codes sequentially within each category (LIA-001, LIA-002, LIA-003...)
2. Return ONLY valid JSON, no markdown backticks

{
  "playbook_summary": "...",
  "extraction_confidence": 0.85,
  "total_rules_extracted": 45,
  "rules": [{ ... }]
}`;

const userPrompt = `Extract ALL negotiation rules from this playbook. Be thorough — extract every rule, red line, position directive, escalation trigger, and approval threshold you can find.

IMPORTANT: Analyse EACH clause individually. Different clauses use different measures (days, months, %, GBP, scope). Do NOT apply one unit across all clauses in a section. Include a range_context for every rule.

PLAYBOOK: ${playbookData.playbook_name}
${wasTruncated ? `[Note: Key sections extracted via ${extractionMethod}. Focus on extracting rules from ALL sections provided.]` : ""}

---
${processedText}
---

Remember: Extract EVERY rule with differentiated positions and per-clause range_context. Count them. Return JSON with playbook_summary, extraction_confidence, total_rules_extracted, and the complete rules array.`;

return {
  playbookId: playbookData.playbook_id,
  companyId: playbookData.company_id,
  playbookName: playbookData.playbook_name,
  systemPrompt,
  userPrompt,
  originalLength,
  processedLength: processedText.length,
  wasTruncated,
  extractionMethod,
};
