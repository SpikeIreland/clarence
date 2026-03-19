// ============================================================================
// PROCESS CLAUDE RESPONSE — Pass 1 JSON parser with truncation recovery
// Location: n8n-workflows/process-claude-response.js
//
// Sits between the Claude API node and Validate Extracted Rules.
// Handles the case where Claude's response is truncated mid-JSON (common on
// large documents that push against the output token limit).
//
// Copy this code into the n8n "Process Claude Response" Code node.
// ============================================================================

const input = $input.first().json;

// Claude API node returns the response in different shapes depending on version
const rawContent =
  input?.message?.content?.[0]?.text ||
  input?.content?.[0]?.text ||
  input?.text ||
  input?.response ||
  "";

if (!rawContent) {
  throw new Error("No content received from Claude API node");
}

// ============================================================================
// STEP 1: Strip markdown fences if Claude wrapped the JSON anyway
// ============================================================================

let jsonStr = rawContent.trim();
if (jsonStr.startsWith("```")) {
  jsonStr = jsonStr
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

// ============================================================================
// STEP 2: Attempt clean parse first
// ============================================================================

let parsed = null;
let wasTruncated = false;

try {
  parsed = JSON.parse(jsonStr);
} catch (firstError) {
  // ============================================================================
  // STEP 3: Truncation recovery
  //
  // Claude truncates mid-string inside clause_inventory. We try to salvage
  // every rule object that completed before the cut-off by:
  //   a) finding the last complete '}' that closes a rule entry
  //   b) closing the array and top-level object around it
  //   c) parsing the reconstructed string
  // ============================================================================

  wasTruncated = true;
  let recovered = false;

  // Find the position of "clause_inventory" array opening
  const arrayStart = jsonStr.indexOf('"clause_inventory"');
  if (arrayStart !== -1) {
    const bracketOpen = jsonStr.indexOf("[", arrayStart);
    if (bracketOpen !== -1) {
      // Work backwards from the end of the (truncated) string to find the last
      // complete rule object — i.e. the last '}' that is at depth 1 inside the array
      const fragment = jsonStr.slice(0, jsonStr.length);
      let depth = 0;
      let lastCompleteRuleEnd = -1;

      for (let i = bracketOpen + 1; i < fragment.length; i++) {
        const ch = fragment[i];
        // Skip over string values (they may contain braces)
        if (ch === '"') {
          i++; // move past opening quote
          while (i < fragment.length) {
            if (fragment[i] === "\\") {
              i += 2; // skip escaped char
              continue;
            }
            if (fragment[i] === '"') break;
            i++;
          }
          continue;
        }
        if (ch === "{") depth++;
        if (ch === "}") {
          depth--;
          if (depth === 0) {
            // This closing brace ends a top-level rule object within the array
            lastCompleteRuleEnd = i;
          }
        }
      }

      if (lastCompleteRuleEnd !== -1) {
        // Reconstruct: everything up to and including the last complete rule,
        // then close the array and the outer object
        const safeFragment = jsonStr.slice(0, lastCompleteRuleEnd + 1);

        // Extract the header fields before clause_inventory
        const headerStr = jsonStr.slice(0, bracketOpen + 1);
        const rulesStr = jsonStr.slice(bracketOpen + 1, lastCompleteRuleEnd + 1);

        const reconstructed = headerStr + rulesStr + "]}";

        try {
          parsed = JSON.parse(reconstructed);
          recovered = true;

          // Patch up the fields that may have been cut off
          if (!parsed.playbook_summary) parsed.playbook_summary = null;
          if (!parsed.extraction_confidence) parsed.extraction_confidence = null;
          parsed.total_rules_extracted = (parsed.clause_inventory || []).length;
          parsed._truncation_recovered = true;
          parsed._original_error = firstError.message;
        } catch (recoveryError) {
          // Recovery also failed — fall through to hard error below
        }
      }
    }
  }

  if (!recovered) {
    throw new Error(
      `Failed to parse Claude response and truncation recovery failed.\n` +
      `Original error: ${firstError.message}\n` +
      `Response length: ${rawContent.length} chars\n` +
      `Tip: increase max_tokens on the Claude node, or reduce document size.`
    );
  }
}

// ============================================================================
// STEP 4: Normalise output
// ============================================================================

const clauseInventory = parsed.clause_inventory || [];

if (clauseInventory.length === 0) {
  throw new Error(
    "Claude returned 0 rules. The document may be too short, in an unsupported " +
    "format, or the response was truncated before any rules were extracted."
  );
}

// Pass through the upstream context fields needed by downstream nodes
const upstreamContext = $input.first().json?._upstreamContext || {};

return {
  ...upstreamContext,
  playbookId: upstreamContext.playbookId || parsed.playbook_id || null,
  companyId: upstreamContext.companyId || null,
  playbookName: upstreamContext.playbookName || parsed.playbook_name || null,
  perspective: parsed.playbook_perspective || upstreamContext.perspective || "customer",
  playbook_summary: parsed.playbook_summary || null,
  extraction_confidence: parsed.extraction_confidence || null,
  total_rules_extracted: clauseInventory.length,
  clause_inventory: clauseInventory,
  // Pass the processed text through for Pass 2
  extractedText: upstreamContext.extractedText || "",
  // Diagnostic fields
  wasTruncated,
  truncationRecovered: parsed._truncation_recovered || false,
  originalParseError: parsed._original_error || null,
};
