<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
/* ============================================================================
   CLARENCE 6.7Q CONTRACT DRAFT — CSS STYLESHEET
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
.snapshot-grid,
.parties-row,
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

.party-name.customer { background: #d1fae5; color: #059669; }
.party-name.provider { background: #dbeafe; color: #2563eb; }

.connector { color: #94a3b8; font-size: 16px; }

.contract-type-label {
    font-size: 12px; color: #475569; font-weight: 500; margin-bottom: 8px;
}

.generated-date {
    font-size: 11px; color: #64748b; margin-bottom: 16px;
}

.draft-notice {
    font-size: 10px; color: #94a3b8; font-style: italic;
    max-width: 500px; margin: 0 auto; line-height: 1.5;
}

/* ============================================================================
   SECTION 4: SECTION STYLING
   ============================================================================ */
.section { margin-bottom: 30px; }

.section h2 {
    font-size: 16px; font-weight: 600; color: #1e293b;
    margin: 0 0 16px 0; padding-bottom: 8px;
    border-bottom: 2px solid #8b5cf6; display: inline-block;
}

/* ============================================================================
   SECTION 5: CONTRACT SNAPSHOT
   ============================================================================ */
.snapshot-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
}

.snapshot-item {
    background: #f8fafc; padding: 16px; border-radius: 8px;
    text-align: center; border: 1px solid #e2e8f0;
}

.snapshot-label {
    font-size: 10px; font-weight: 600; color: #64748b;
    text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;
}

.snapshot-value { font-size: 14px; font-weight: 600; color: #1e293b; }
.snapshot-value.agreed { color: #059669; }
.snapshot-value.queried { color: #d97706; }

/* ============================================================================
   SECTION 6: PARTIES ROW
   ============================================================================ */
.parties-row {
    display: flex; align-items: center; justify-content: center; gap: 24px;
    padding: 20px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;
}

.party-inline {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
}

.party-role-tag {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.8px; padding: 3px 10px; border-radius: 4px;
}

.party-inline.customer .party-role-tag { background: #d1fae5; color: #059669; }
.party-inline.provider .party-role-tag { background: #dbeafe; color: #2563eb; }

.party-company-name { font-size: 14px; font-weight: 600; color: #1e293b; }
.party-contact-name { font-size: 11px; color: #64748b; }
.party-separator { font-size: 12px; color: #94a3b8; font-style: italic; }

/* ============================================================================
   SECTION 7: CONTRACT BODY
   ============================================================================ */
.contract-body-wrapper {
    margin-bottom: 30px; padding: 30px; background: white;
    border: 1px solid #e2e8f0; border-radius: 12px;
    border-top: 3px solid #8b5cf6;
}

/* Contract clause headings — these are real section headings, NOT suppressed */
.contract-body.ai-content h2 {
    font-size: 16px; font-weight: 700; color: #1e293b;
    margin: 28px 0 12px 0; padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
    page-break-after: avoid !important;
}

.contract-body.ai-content h3 {
    font-size: 14px; font-weight: 600; color: #334155;
    margin: 20px 0 8px 0;
    page-break-after: avoid !important;
}

.contract-body.ai-content h4 {
    font-size: 12px; font-weight: 600; color: #475569;
    margin: 16px 0 6px 0;
}

.contract-body.ai-content p {
    margin: 0 0 12px 0; font-size: 11pt; line-height: 1.7;
    color: #334155; text-align: justify;
}

.contract-body.ai-content p:last-child { margin-bottom: 0; }
.contract-body.ai-content strong { color: #1e293b; font-weight: 600; }
.contract-body.ai-content em { color: #475569; }

.contract-body.ai-content ul,
.contract-body.ai-content ol {
    margin: 8px 0 14px 0; padding-left: 24px;
}

.contract-body.ai-content li {
    font-size: 11pt; line-height: 1.7; color: #334155; margin-bottom: 6px;
}

.contract-body.ai-content li:last-child { margin-bottom: 0; }
.contract-body.ai-content ol > li { padding-left: 4px; }

.contract-body.ai-content ul ul,
.contract-body.ai-content ol ol,
.contract-body.ai-content ol ul {
    margin-top: 4px; margin-bottom: 4px;
}

/* ============================================================================
   SECTION 8: DRAFT DISCLAIMER
   ============================================================================ */
.disclaimer-block {
    display: flex; align-items: flex-start; gap: 16px;
    padding: 20px; background: #fffbeb;
    border: 1px solid #fde68a; border-radius: 10px;
    margin-bottom: 30px;
}

.disclaimer-icon { font-size: 24px; flex-shrink: 0; margin-top: 2px; }

.disclaimer-text { font-size: 10px; line-height: 1.6; color: #92400e; }
.disclaimer-text strong { font-size: 11px; color: #78350f; }

/* ============================================================================
   SECTION 9: PRINT STYLES
   ============================================================================ */
@media print {
    body { padding: 0; font-size: 10pt; }
    .contract-body-wrapper { border: none; padding: 0; }

    .section, .snapshot-grid, .parties-row, .disclaimer-block {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
    }

    .title-block { page-break-after: avoid !important; }

    .party-role-tag, .snapshot-item, .party-name {
        -webkit-print-color-adjust: exact;
        color-adjust: exact;
        print-color-adjust: exact;
    }
}
</style>