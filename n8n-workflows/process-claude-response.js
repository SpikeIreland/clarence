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
  // every rule object that completed before the cut-off.
  //
  // Strategy A — depth tracking (fast, accurate):
  //   Walk forward tracking brace depth; record every position where a
  //   top-level rule object closes (depth returns to 0). Use the last such
  //   position as the safe cut-off point.
  //
  // Strategy B — backward scan (resilient fallback):
  //   If Strategy A finds nothing (truncation hit the very first rule, or a
  //   string-skipping edge case threw the depth counter off), walk backward
  //   through every '}' in the rules section and attempt JSON.parse on each
  //   candidate reconstruction until one succeeds.
  // ============================================================================

  wasTruncated = true;
  let recovered = false;

  const arrayStart = jsonStr.indexOf('"clause_inventory"');
  if (arrayStart !== -1) {
    const bracketOpen = jsonStr.indexOf("[", arrayStart);
    if (bracketOpen !== -1) {
      const headerStr = jsonStr.slice(0, bracketOpen + 1); // up to and including '['

      // ---- Strategy A: forward depth-tracking scan -------------------------
      let depth = 0;
      let lastCompleteRuleEnd = -1;

      for (let i = bracketOpen + 1; i < jsonStr.length; i++) {
        const ch = jsonStr[i];
        // Skip over string literals — they may contain braces that would
        // corrupt the depth counter
        if (ch === '"') {
          i++;
          while (i < jsonStr.length) {
            if (jsonStr[i] === "\\") {
              i += 2; // skip escaped character (handles \" correctly)
              continue;
            }
            if (jsonStr[i] === '"') break;
            i++;
          }
          continue;
        }
        if (ch === "{") depth++;
        if (ch === "}") {
          depth--;
          if (depth === 0) {
            lastCompleteRuleEnd = i;
          }
        }
      }

      if (lastCompleteRuleEnd !== -1) {
        const rulesStr = jsonStr.slice(bracketOpen + 1, lastCompleteRuleEnd + 1);
        const reconstructed = headerStr + rulesStr + "]}";
        try {
          parsed = JSON.parse(reconstructed);
          recovered = true;
          parsed.playbook_summary = parsed.playbook_summary || null;
          parsed.extraction_confidence = parsed.extraction_confidence || null;
          parsed.total_rules_extracted = (parsed.clause_inventory || []).length;
          parsed._truncation_recovered = true;
          parsed._recovery_strategy = "depth-tracking";
          parsed._original_error = firstError.message;
        } catch (_strategyAParseError) {
          // Boundary looked right but reconstruction is still malformed —
          // fall through to Strategy B
        }
      }

      // ---- Strategy B: backward scan through all '}' positions -------------
      if (!recovered) {
        // Collect every '}' position inside the rules section
        const closingBraces = [];
        for (let i = bracketOpen + 1; i < jsonStr.length; i++) {
          if (jsonStr[i] === "}") closingBraces.push(i);
        }

        // Try from the rightmost '}' leftward — we typically succeed within
        // the first few iterations (the truncation is near the end)
        for (let idx = closingBraces.length - 1; idx >= 0 && !recovered; idx--) {
          const cutoff = closingBraces[idx];
          const rulesStr = jsonStr.slice(bracketOpen + 1, cutoff + 1);
          const reconstructed = headerStr + rulesStr + "]}";
          try {
            parsed = JSON.parse(reconstructed);
            recovered = true;
            parsed.playbook_summary = parsed.playbook_summary || null;
            parsed.extraction_confidence = parsed.extraction_confidence || null;
            parsed.total_rules_extracted = (parsed.clause_inventory || []).length;
            parsed._truncation_recovered = true;
            parsed._recovery_strategy = "backward-scan";
            parsed._original_error = firstError.message;
          } catch (_strategyBParseError) {
            // Keep scanning leftward
          }
        }
      }
    }
  }

  if (!recovered) {
    throw new Error(
      `Failed to parse Claude response and truncation recovery failed.\n` +
      `Original error: ${firstError.message}\n` +
      `Response length: ${rawContent.length} chars\n` +
      `clause_inventory found: ${jsonStr.includes('"clause_inventory"')}\n` +
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
  recoveryStrategy: parsed._recovery_strategy || null,
  originalParseError: parsed._original_error || null,
};
