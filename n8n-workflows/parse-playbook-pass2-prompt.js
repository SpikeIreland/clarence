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
const documentType = batchData.documentType || "playbook";

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
      `<clause index="${i}" code="${clause.clause_code}" category="${clause.category}" schedule_type="${clause.schedule_type || 'null'}">
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

// Build contract-specific guidance if document is a contract
const contractGuidance = documentType === "contract" ? `
═══════════════════════════════════════════════════
IMPORTANT: THIS IS A CONTRACT (not a playbook)
═══════════════════════════════════════════════════

The source document is an executed or draft CONTRACT, not a negotiation playbook. The source quotes contain SPECIFIC AGREED TERMS rather than negotiation ranges.

Your job is to INFER reasonable negotiation positions around the stated contract term, using your knowledge of market standards and typical negotiation ranges for ${perspective === "provider" ? "PROVIDER" : "CUSTOMER"} organisations.

HOW TO MAP CONTRACT TERMS TO POSITIONS:
1. The stated contract term represents WHERE the negotiation landed — typically near the middle of what was acceptable to both parties.
2. Build a realistic negotiation range AROUND that stated term:
   - ideal_position: What the ${perspective === "provider" ? "provider" : "customer"} would have PREFERRED (more favourable than the stated term)
   - fallback_position: Place near the stated contract term (since that is what was actually agreed)
   - minimum_position: The worst the ${perspective === "provider" ? "provider" : "customer"} should accept
   - maximum_position: The best-case aspiration
3. Spread positions across the 1-10 range. Do NOT set all four positions to the same value.

EXAMPLE (Customer perspective):
- Contract says: "Liability cap of 100% of annual charges"
  → ideal_position: 8 (aim for 150-200%)
  → fallback_position: 6 (100% is acceptable, near where it landed)
  → minimum_position: 4 (below 75% is concerning)
  → maximum_position: 10 (uncapped or 300%+)

EXAMPLE (Provider perspective):
- Contract says: "Notice period of 90 days"
  → ideal_position: 7 (aim for 120+ days)
  → fallback_position: 5 (90 days is market standard)
  → minimum_position: 3 (30 days is too short)
  → maximum_position: 9 (180 days)
` : "";

const systemPrompt = `You are an expert at mapping negotiation positions from corporate contract documents.

YOUR TASK (PASS 2 OF 2): For each clause provided, assign position values and build a range_context scale. The clause inventory (names, categories, units, and SOURCE QUOTES) was extracted in Pass 1.
${contractGuidance}
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

Each clause's <source_quote> contains the EXACT text from the document. Your positions MUST reflect the values stated in the source quote.
${documentType === "contract" ? `
For CONTRACTS: The source quote shows the agreed term. Use it as the anchor point for your fallback_position, then infer ideal/minimum/maximum around it based on market knowledge.` : `
For PLAYBOOKS: The source quote contains negotiation guidance with ranges. Map the stated preferred position to ideal_position, the stated floor to minimum_position, etc.`}

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
  "source": "${documentType === "contract" ? "inferred_from_contract" : "parsed"}"
}

RULES for scale_points:
- EXACTLY 3 points: positions 1, 5, and 10
- Labels must use the SAME unit as the clause (if unit is "years", all labels must be in years)
- NEVER mix units within a single scale (e.g., never have "50%" AND "perpetual" in the same scale)

═══════════════════════════════════════════════════
CRITICAL — SCALE DIRECTION MUST MATCH PERSPECTIVE
═══════════════════════════════════════════════════

The scale_points labels MUST always follow the SAME direction as the position scale:

${perspective === "provider"
  ? `PROVIDER perspective → Position 1 label = WORST outcome for the provider, Position 10 label = BEST outcome for the provider.

EXAMPLES (Provider perspective):
- Liability Cap:        Position 1 = "Unlimited liability"       → Position 10 = "50% of fees"
- Cyber Liability:      Position 1 = "Unlimited cyber liability" → Position 10 = "Capped/No cyber liability"
- Notice Period:        Position 1 = "7 days"                    → Position 10 = "180 days"
- Payment Terms:        Position 1 = "7 days"                    → Position 10 = "90 days"
- Exclusion of Loss:    Position 1 = "No exclusions"             → Position 10 = "Broad exclusions"

WRONG (inverted scale — DO NOT DO THIS):
- Cyber Liability:      Position 1 = "No unlimited liability"    → Position 10 = "Unlimited cyber liability"
  ^^^ This is WRONG because "No unlimited liability" is the BEST outcome for the provider, so it belongs at position 10, not position 1.`
  : `CUSTOMER perspective → Position 1 label = WORST outcome for the customer, Position 10 label = BEST outcome for the customer.

EXAMPLES (Customer perspective):
- Liability Cap:        Position 1 = "50% of fees"               → Position 10 = "Unlimited liability"
- SLA:                  Position 1 = "95% uptime"                → Position 10 = "99.99% uptime"
- Breach Notification:  Position 1 = "No SLA"                    → Position 10 = "4 hours"
- Audit Rights:         Position 1 = "No audit right"            → Position 10 = "Full audit access"

WRONG (inverted scale — DO NOT DO THIS):
- SLA:                  Position 1 = "99.99% uptime"             → Position 10 = "95% uptime"
  ^^^ This is WRONG because "99.99% uptime" is the BEST outcome for the customer, so it belongs at position 10, not position 1.`}

SELF-CHECK: Before outputting each rule, verify that the label at position 1 is the LEAST desirable outcome for the ${perspective === "provider" ? "provider" : "customer"}, and position 10 is the MOST desirable. If you find yourself putting the ideal outcome at position 1 with ideal_position=1, YOUR SCALE IS INVERTED — flip it.

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
      "schedule_type": null,
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

const docTypeLabel = documentType === "contract" ? "CONTRACT" : "PLAYBOOK";
const userPrompt = `Assign positions and range_context for these ${clauseInventory.length} clauses from the "${playbookName}" ${perspective === "provider" ? "PROVIDER" : "CUSTOMER"} ${docTypeLabel.toLowerCase()}.

${documentType === "contract" ? `IMPORTANT: This is a CONTRACT, not a playbook. The source quotes contain agreed terms, not negotiation ranges. Infer realistic negotiation positions around each stated term based on market standards and ${perspective} perspective. Spread positions across the 1-10 range — do NOT set all four positions to the same value.` : `CRITICAL: Your positions and scale_points MUST match the source quotes provided. Do NOT invent values that contradict the quotes.`}

${clauseList}

${extractedText ? `\nFor reference, here is the relevant document text:\n---\n${extractedText.substring(0, 40000)}\n---` : ""}

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
