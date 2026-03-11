// ============================================================================
// PLAYBOOK EXTRACTION — PASS 2: POSITIONS & RANGE CONTEXT
// Location: n8n-workflows/parse-playbook-pass2-prompt.js
//
// Receives the clause inventory from Pass 1 (with source quotes and units)
// and a batch of categories to process. Extracts positions, range_context,
// rationale, and negotiation tips anchored to the source quotes.
//
// In the n8n workflow, this runs inside a loop over category batches.
// Each batch processes 3-5 related categories.
// ============================================================================

// Input: output from "Process Pass 1 Response" or the batch splitter
const batchData = $input.first().json;

const perspective = batchData.perspective || "customer";
const clauseInventory = batchData.batchClauses || [];
const extractedText = batchData.extractedText || "";
const playbookName = batchData.playbookName || "";

if (!clauseInventory.length) {
  return { skipAI: true, rules: [] };
}

// ============================================================================
// Build perspective-aware scale definition
// ============================================================================

const scaleDefinition =
  perspective === "provider"
    ? `POSITION SCALE (1-10) — PROVIDER PERSPECTIVE
Position 1  = Weakest for provider (maximum concession to customer)
Position 5  = Balanced / Market standard
Position 10 = Strongest for provider (maximum protection for provider)
Higher = MORE favourable for the PROVIDER.`
    : `POSITION SCALE (1-10) — CUSTOMER PERSPECTIVE
Position 1  = Maximum flexibility for the provider/supplier
Position 5  = Balanced / Market standard
Position 10 = Maximum protection for the customer/buyer
Higher = MORE protection for the CUSTOMER.`;

// ============================================================================
// Build clause list for this batch
// ============================================================================

const clauseList = clauseInventory
  .map(
    (clause, i) =>
      `<clause index="${i}" code="${clause.clause_code}" category="${clause.category}">
<name>${clause.clause_name}</name>
<unit>${clause.unit_of_measurement || "unknown"}</unit>
<value_type>${clause.value_type || "text"}</value_type>
<source_quote>${clause.source_quote || "No source quote available — infer from general knowledge"}</source_quote>
<deal_breaker>${clause.is_deal_breaker || false}</deal_breaker>
<non_negotiable>${clause.is_non_negotiable || false}</non_negotiable>
<importance>${clause.importance_level || 5}</importance>
</clause>`,
  )
  .join("\n\n");

// ============================================================================
// PASS 2 PROMPT
// ============================================================================

const systemPrompt = `You are an expert at mapping negotiation positions from corporate contract playbooks.

YOUR TASK (PASS 2 OF 2): For each clause provided, assign position values and build a range_context scale. The clause inventory (names, categories, units, and SOURCE QUOTES) was extracted in Pass 1.

${scaleDefinition}

═══════════════════════════════════════════════════
FOUR POSITION VALUES PER RULE
═══════════════════════════════════════════════════

- ideal_position: The company's PREFERRED opening position.
- minimum_position: The absolute FLOOR. Below this is unacceptable.
- maximum_position: Best case / aspirational ceiling.
- fallback_position: Compromise if ideal is rejected.

RULES:
- minimum_position <= fallback_position <= ideal_position <= maximum_position
- All four values MUST be different from each other when the source quote provides enough context.
- Use the FULL 1-10 range. Do not cluster everything around 5-6.

═══════════════════════════════════════════════════
CRITICAL — ANCHOR TO SOURCE QUOTES
═══════════════════════════════════════════════════

Each clause's <source_quote> contains the EXACT text from the playbook. Your positions MUST reflect the values stated in the source quote.

EXAMPLES:
- If source_quote says "1-5 years": position 1 label ≤1 year, position 10 label ≥5 years
- If source_quote says "liability shall not exceed 150% of annual charges": ideal_position should place 150% at position 7-8
- If source_quote says "minimum 30 days notice": minimum_position should correspond to 30 days on the scale

DO NOT invent different values. If the quote says "1-5 years", do NOT output "1-3 years".

═══════════════════════════════════════════════════
RANGE CONTEXT — REQUIRED FOR EACH RULE
═══════════════════════════════════════════════════

"range_context": {
  "value_type": "<from Pass 1>",
  "range_unit": "<from Pass 1 unit_of_measurement>",
  "scale_points": [
    { "position": 1, "label": "<value at pos 1>", "value": <number> },
    { "position": 5, "label": "<value at pos 5>", "value": <number> },
    { "position": 10, "label": "<value at pos 10>", "value": <number> }
  ],
  "source": "parsed"
}

RULES for scale_points:
- EXACTLY 3 points: positions 1, 5, and 10
- Labels must use the SAME unit as the clause (if unit is "years", all labels must be in years)
- Values must progress monotonically (always increasing from 1 to 10)
- For qualitative clauses (scope, rights), use descriptive labels:
  Position 1: "Narrow/Restricted", Position 5: "Standard/Balanced", Position 10: "Broad/Comprehensive"
- NEVER mix units within a single scale (e.g., never have "50%" AND "perpetual" in the same scale)

═══════════════════════════════════════════════════
EVERY RULE MUST HAVE UNIQUE POSITIONS
═══════════════════════════════════════════════════

Even within the same category, each clause deals with a DIFFERENT aspect. Read the source_quote for EACH clause and assign positions based on what IT says.

WRONG: Two liability clauses with identical ideal=8, min=6, max=10, fallback=7
RIGHT: "Liability Cap" ideal=8 (150% fees), "Consequential Loss" ideal=9 (must exclude)

═══════════════════════════════════════════════════
OTHER FIELDS — KEEP TEXT SHORT (max 12 words)
═══════════════════════════════════════════════════

- rationale: Why this matters (max 12 words)
- negotiation_tips: Key tactic (max 12 words)

═══════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════

Return ONLY valid JSON (no markdown backticks):

{
  "rules": [
    {
      "clause_code": "LIA-001",
      "clause_name": "Liability Cap",
      "category": "liability",
      "source_quote": "<copied from Pass 1>",
      "ideal_position": 8,
      "minimum_position": 5,
      "maximum_position": 10,
      "fallback_position": 7,
      "rationale": "Limits financial exposure to fees",
      "negotiation_tips": "Offer higher cap for longer term",
      "escalation_trigger": "<from Pass 1 or null>",
      "escalation_contact": "<from Pass 1 or null>",
      "requires_approval_below": null,
      "importance_level": 9,
      "is_deal_breaker": false,
      "is_non_negotiable": false,
      "range_context": {
        "value_type": "percentage",
        "range_unit": "% of annual fees",
        "scale_points": [
          { "position": 1, "label": "50%", "value": 50 },
          { "position": 5, "label": "150%", "value": 150 },
          { "position": 10, "label": "Unlimited", "value": 999 }
        ],
        "source": "parsed"
      }
    }
  ]
}`;

const userPrompt = `Assign positions and range_context for these ${clauseInventory.length} clauses from the "${playbookName}" ${perspective === "provider" ? "PROVIDER" : "CUSTOMER"} playbook.

CRITICAL: Your positions and scale_points MUST match the source quotes provided. Do NOT invent values that contradict the quotes.

${clauseList}

${extractedText ? `\nFor reference, here is the relevant playbook text:\n---\n${extractedText.substring(0, 40000)}\n---` : ""}

Assign positions and range_context for ALL ${clauseInventory.length} clauses above. Each must have unique positions and a range_context with correctly-typed scale_points matching its unit. Return ONLY the JSON object.`;

// Build the Claude API request body
const requestBody = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 12000,
  temperature: 0,
  system: systemPrompt,
  messages: [
    {
      role: "user",
      content: userPrompt,
    },
  ],
};

return {
  skipAI: false,
  requestBody,
  clauseCount: clauseInventory.length,
  batchCategories: [
    ...new Set(clauseInventory.map((c) => c.category)),
  ].join(", "),
};
