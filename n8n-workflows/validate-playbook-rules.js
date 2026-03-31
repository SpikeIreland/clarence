// ============================================================================
// VALIDATE PLAYBOOK RULES — Post-extraction quality checks
// Location: n8n-workflows/validate-playbook-rules.js
//
// Runs AFTER Process Claude Response, BEFORE Split Into Rules.
// Adds quality_flags to each rule and sets hasQualityIssues flag.
//
// Copy this code into the n8n "Validate Extracted Rules" Code node.
// ============================================================================

const input = $input.first().json;
const rules = input.rules || [];

// ============================================================================
// VALIDATION CHECKS
// ============================================================================

// Group rules by normalised category
const categoryGroups = {};
for (const rule of rules) {
  const cat = (rule.category || "general").toLowerCase().trim();
  if (!categoryGroups[cat]) categoryGroups[cat] = [];
  categoryGroups[cat].push(rule);
}

for (const rule of rules) {
  if (!rule.quality_flags) rule.quality_flags = [];
  // Parse quality_flags if it's a string (from prior step)
  if (typeof rule.quality_flags === "string") {
    try {
      rule.quality_flags = JSON.parse(rule.quality_flags);
    } catch {
      rule.quality_flags = [];
    }
  }
}

// --------------------------------------------------------------------------
// CHECK 1: Duplicate range_unit + scale_points within same category
// --------------------------------------------------------------------------
for (const [cat, catRules] of Object.entries(categoryGroups)) {
  for (let i = 0; i < catRules.length; i++) {
    for (let j = i + 1; j < catRules.length; j++) {
      const riCtx =
        typeof catRules[i].range_context === "string"
          ? JSON.parse(catRules[i].range_context || "{}")
          : catRules[i].range_context;
      const rjCtx =
        typeof catRules[j].range_context === "string"
          ? JSON.parse(catRules[j].range_context || "{}")
          : catRules[j].range_context;

      if (!riCtx || !rjCtx) continue;

      const iLabels = (riCtx.scale_points || [])
        .map((sp) => sp.label)
        .join("|");
      const jLabels = (rjCtx.scale_points || [])
        .map((sp) => sp.label)
        .join("|");

      if (
        riCtx.range_unit === rjCtx.range_unit &&
        iLabels === jLabels &&
        iLabels.length > 0
      ) {
        if (!catRules[i].quality_flags.includes("duplicate_range_in_category"))
          catRules[i].quality_flags.push("duplicate_range_in_category");
        if (!catRules[j].quality_flags.includes("duplicate_range_in_category"))
          catRules[j].quality_flags.push("duplicate_range_in_category");
      }
    }
  }
}

// --------------------------------------------------------------------------
// CHECK 2: Mixed value types within a single rule's scale_points
// --------------------------------------------------------------------------
for (const rule of rules) {
  const ctx =
    typeof rule.range_context === "string"
      ? JSON.parse(rule.range_context || "{}")
      : rule.range_context;

  if (!ctx?.scale_points?.length) {
    if (!rule.quality_flags.includes("missing_range_context"))
      rule.quality_flags.push("missing_range_context");
    continue;
  }

  const labels = ctx.scale_points.map((sp) => (sp.label || "").toLowerCase());
  const hasPercentage = labels.some((l) => l.includes("%"));
  const hasDuration = labels.some((l) =>
    /year|month|day|week|hour|perpetual|indefinite/i.test(l),
  );
  const hasCurrency = labels.some((l) => /\$|£|€|gbp|usd|eur/i.test(l));
  const typeCount = [hasPercentage, hasDuration, hasCurrency].filter(
    Boolean,
  ).length;

  if (typeCount > 1) {
    if (!rule.quality_flags.includes("mixed_value_types"))
      rule.quality_flags.push("mixed_value_types");
  }
}

// --------------------------------------------------------------------------
// CHECK 3: Duplicate positions within same category
// --------------------------------------------------------------------------
for (const [cat, catRules] of Object.entries(categoryGroups)) {
  for (let i = 0; i < catRules.length; i++) {
    for (let j = i + 1; j < catRules.length; j++) {
      if (
        catRules[i].ideal_position === catRules[j].ideal_position &&
        catRules[i].minimum_position === catRules[j].minimum_position &&
        catRules[i].maximum_position === catRules[j].maximum_position
      ) {
        if (
          !catRules[i].quality_flags.includes(
            "duplicate_positions_in_category",
          )
        )
          catRules[i].quality_flags.push("duplicate_positions_in_category");
        if (
          !catRules[j].quality_flags.includes(
            "duplicate_positions_in_category",
          )
        )
          catRules[j].quality_flags.push("duplicate_positions_in_category");
      }
    }
  }
}

// --------------------------------------------------------------------------
// CHECK 4: Inverted scale — ideal_position points to a low-position label
// (suggests the AI put the best outcome at position 1 instead of 10)
// --------------------------------------------------------------------------
for (const rule of rules) {
  const ctx =
    typeof rule.range_context === "string"
      ? JSON.parse(rule.range_context || "{}")
      : rule.range_context;

  if (!ctx?.scale_points?.length || !rule.ideal_position) continue;

  // If ideal_position <= 2 AND the label at position 1 contains words that
  // suggest it's the BEST outcome (not worst), flag as inverted
  const sorted = [...ctx.scale_points].sort((a, b) => a.position - b.position);
  const pos1Label = (sorted[0]?.label || "").toLowerCase();
  const pos10Label = (sorted[sorted.length - 1]?.label || "").toLowerCase();

  // Heuristic: "no" or "none" or "zero" or "minimal" at position 1 with
  // "unlimited" or "full" or "comprehensive" or "broad" at position 10
  // AND ideal_position <= 2 suggests the scale is inverted for a provider playbook
  const pos1LooksProtective = /\bno\b|none|zero|minimal|excluded|capped|limited|low\b|restrict/i.test(pos1Label);
  const pos10LooksRisky = /unlimited|uncapped|full|comprehensive|broad|maximum|highest/i.test(pos10Label);

  if (rule.ideal_position <= 2 && pos1LooksProtective && pos10LooksRisky) {
    if (!rule.quality_flags.includes("likely_inverted_scale"))
      rule.quality_flags.push("likely_inverted_scale");
  }

  // Also check the reverse: ideal_position >= 9 with position 10 looking protective
  const highPosLooksProtective = /\bno\b|none|zero|minimal|excluded|capped|limited|low\b|restrict/i.test(pos10Label);
  const lowPosLooksRisky = /unlimited|uncapped|full|comprehensive|broad|maximum|highest/i.test(pos1Label);

  if (rule.ideal_position >= 9 && highPosLooksProtective && lowPosLooksRisky) {
    // This pattern (ideal=high, pos10=protective, pos1=risky) can be correct
    // for provider perspective BUT only if the perspective is provider.
    // We flag it for review rather than auto-correct.
    if (!rule.quality_flags.includes("scale_direction_review"))
      rule.quality_flags.push("scale_direction_review");
  }
}

// --------------------------------------------------------------------------
// CHECK 5: Nonsensical scale progression (position 1 label > position 10)
// --------------------------------------------------------------------------
for (const rule of rules) {
  const ctx =
    typeof rule.range_context === "string"
      ? JSON.parse(rule.range_context || "{}")
      : rule.range_context;

  if (!ctx?.scale_points?.length) continue;

  const sorted = [...ctx.scale_points].sort(
    (a, b) => a.position - b.position,
  );
  const values = sorted.map((sp) => sp.value).filter((v) => v != null);

  if (values.length >= 2) {
    // Check monotonic progression
    let nonMonotonic = false;
    for (let k = 1; k < values.length; k++) {
      if (values[k] < values[k - 1]) {
        nonMonotonic = true;
        break;
      }
    }
    // Note: some scales are intentionally descending (e.g., payment days: 90→7)
    // So only flag if it's neither monotonically increasing nor decreasing
    if (nonMonotonic) {
      let allDescending = true;
      for (let k = 1; k < values.length; k++) {
        if (values[k] > values[k - 1]) {
          allDescending = false;
          break;
        }
      }
      if (!allDescending) {
        if (!rule.quality_flags.includes("non_monotonic_scale"))
          rule.quality_flags.push("non_monotonic_scale");
      }
    }
  }
}

// ============================================================================
// STRINGIFY quality_flags for SQL insertion
// ============================================================================
for (const rule of rules) {
  rule.quality_flags = JSON.stringify(rule.quality_flags || []);
}

// ============================================================================
// SUMMARY
// ============================================================================
const flaggedRules = rules.filter((r) => {
  const flags = JSON.parse(r.quality_flags || "[]");
  return flags.length > 0;
});

const hasQualityIssues = flaggedRules.length > 0;

const flagSummary = {};
for (const rule of rules) {
  const flags = JSON.parse(rule.quality_flags || "[]");
  for (const flag of flags) {
    flagSummary[flag] = (flagSummary[flag] || 0) + 1;
  }
}

return {
  ...input,
  rules,
  hasQualityIssues,
  flaggedRuleCount: flaggedRules.length,
  flagSummary,
};
