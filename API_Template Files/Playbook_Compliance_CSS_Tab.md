<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
/* ============================================================================
   CLARENCE 6.6Q PLAYBOOK COMPLIANCE REPORT — CSS STYLESHEET
   Quick Contract variant
   ============================================================================ */

/* ============================================================================
   SECTION 1: BASE STYLES
   ============================================================================ */
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    padding: 0;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #334155;
    background-color: #ffffff;
}

/* ============================================================================
   SECTION 2: PAGE BREAK CONTROLS
   ============================================================================ */
.section,
.score-card,
.compliance-table,
.disclaimer-block {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
}

h1, h2, h3, h4 {
    page-break-after: avoid !important;
    break-after: avoid !important;
    orphans: 3;
    widows: 3;
}

/* Allow long tables to break across pages */
.compliance-table tbody tr {
    page-break-inside: avoid !important;
}

/* ============================================================================
   SECTION 3: TITLE BLOCK
   ============================================================================ */
.title-block {
    text-align: center;
    padding: 40px 30px;
    margin-bottom: 30px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
}

.title-block h1 {
    font-size: 26px;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 20px 0;
    line-height: 1.3;
}

.parties-headline {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-bottom: 12px;
}

.party-name {
    font-size: 14px;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: 6px;
}

.party-name.initiator { background: #d1fae5; color: #059669; }
.party-name.respondent { background: #dbeafe; color: #2563eb; }

.connector { color: #94a3b8; font-size: 16px; }

.contract-type-label {
    font-size: 12px; color: #475569; font-weight: 500; margin-bottom: 8px;
}

.generated-date {
    font-size: 11px; color: #64748b; margin-bottom: 16px;
}

.privacy-notice {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #7c3aed;
    background: #f5f3ff;
    border: 1px solid #ddd6fe;
    border-radius: 6px;
    padding: 6px 14px;
    margin-top: 4px;
}

.lock-icon { font-size: 11px; }

/* ============================================================================
   SECTION 4: SECTION STYLING
   ============================================================================ */
.section { margin-bottom: 30px; }

.section h2 {
    font-size: 16px; font-weight: 600; color: #1e293b;
    margin: 0 0 8px 0; padding-bottom: 8px;
    border-bottom: 2px solid #8b5cf6; display: inline-block;
}

.section-subtitle {
    font-size: 10px; color: #64748b; margin-bottom: 16px;
}

/* ============================================================================
   SECTION 5: OVERALL SCORE CARD
   ============================================================================ */
.score-card {
    display: flex;
    align-items: center;
    gap: 32px;
    padding: 24px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
}

.score-ring-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

.score-ring {
    width: 90px;
    height: 90px;
    border-radius: 50%;
    border: 6px solid #10b981;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.score-number {
    font-size: 28px;
    font-weight: 800;
    line-height: 1;
}

.score-unit {
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    margin-top: -2px;
}

.score-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.score-breakdown { flex: 1; }

/* ============================================================================
   SECTION 6: SNAPSHOT GRID (reused from contract draft)
   ============================================================================ */
.snapshot-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
}

.snapshot-item {
    background: white; padding: 14px 12px; border-radius: 8px;
    text-align: center; border: 1px solid #e2e8f0;
}

.snapshot-label {
    font-size: 9px; font-weight: 600; color: #64748b;
    text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;
}

.snapshot-value { font-size: 20px; font-weight: 700; color: #1e293b; }
.snapshot-item.passed .snapshot-value { color: #059669; }
.snapshot-item.warning .snapshot-value { color: #d97706; }
.snapshot-item.failed .snapshot-value { color: #dc2626; }
.snapshot-item.total .snapshot-value { color: #475569; }

/* ============================================================================
   SECTION 7: BREACH BADGE
   ============================================================================ */
.breach-badge {
    display: inline-block;
    background: #fef2f2;
    color: #dc2626;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 10px;
    border-radius: 4px;
    border: 1px solid #fecaca;
    vertical-align: middle;
    margin-left: 8px;
    letter-spacing: 0.5px;
}

/* ============================================================================
   SECTION 8: COMPLIANCE TABLE
   ============================================================================ */
.compliance-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
}

.compliance-table thead th {
    background: #f1f5f9;
    color: #475569;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    font-size: 8px;
    padding: 8px 10px;
    text-align: left;
    border-bottom: 2px solid #e2e8f0;
}

.compliance-table tbody td {
    padding: 10px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    vertical-align: top;
    line-height: 1.5;
}

.compliance-table tbody tr:last-child td {
    border-bottom: none;
}

/* Column widths */
.col-status { width: 72px; }
.col-rule { width: 25%; }
.col-clause { width: 20%; }
.col-category { width: 20%; }
.col-detail { width: auto; }
.col-score { width: 100px; }
.col-rules { width: 50px; text-align: center; }
.col-position { width: 60px; text-align: center; }
.col-range { width: 100px; text-align: center; }

/* ============================================================================
   SECTION 9: STATUS BADGE
   ============================================================================ */
.status-badge {
    display: inline-block;
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 3px 8px;
    border-radius: 4px;
    white-space: nowrap;
}

/* ============================================================================
   SECTION 10: MINI PROGRESS BAR (category scores)
   ============================================================================ */
.mini-bar-container {
    width: 60px;
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
    display: inline-block;
    vertical-align: middle;
    margin-right: 6px;
}

.mini-bar {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
}

.score-text {
    font-size: 10px;
    font-weight: 600;
    color: #334155;
    vertical-align: middle;
}

/* ============================================================================
   SECTION 11: EMPTY STATE
   ============================================================================ */
.empty-state {
    text-align: center;
    padding: 24px;
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    font-size: 11px;
    color: #94a3b8;
    font-style: italic;
}

/* ============================================================================
   SECTION 12: DISCLAIMER BLOCK
   ============================================================================ */
.disclaimer-block {
    display: flex; align-items: flex-start; gap: 16px;
    padding: 20px; background: #f5f3ff;
    border: 1px solid #ddd6fe; border-radius: 10px;
    margin-bottom: 30px;
}

.disclaimer-icon { font-size: 24px; flex-shrink: 0; margin-top: 2px; }

.disclaimer-text { font-size: 10px; line-height: 1.6; color: #5b21b6; }
.disclaimer-text strong { font-size: 11px; color: #4c1d95; }

/* ============================================================================
   SECTION 13: PRINT STYLES
   ============================================================================ */
@media print {
    body { padding: 0; font-size: 10pt; }

    .section, .score-card, .compliance-table, .disclaimer-block {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
    }

    .title-block { page-break-after: avoid !important; }

    .party-name, .snapshot-item, .status-badge, .breach-badge,
    .score-ring, .mini-bar, .mini-bar-container, .privacy-notice {
        -webkit-print-color-adjust: exact;
        color-adjust: exact;
        print-color-adjust: exact;
    }
}
</style>
