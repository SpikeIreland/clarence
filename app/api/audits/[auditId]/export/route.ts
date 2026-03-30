// ============================================================================
// FILE: app/api/audits/[auditId]/export/route.ts
// PURPOSE: Export alignment audit reports as Word (.docx) or PDF
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, LevelFormat,
    HeadingLevel, BorderStyle, WidthType, ShadingType,
    PageNumber, PageBreak,
} from 'docx'
import type {
    AlignmentReportResult,
    CategoryNarrative,
} from '@/lib/alignment-engine'
import { getTierLabel } from '@/lib/alignment-engine'
import type { ComplianceResult, CategoryResult, ScoredRule } from '@/lib/playbook-compliance'
import { getCategoryDisplayName } from '@/lib/playbook-compliance'

// ============================================================================
// SUPABASE CLIENT (service role for server-side access)
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ============================================================================
// TYPES
// ============================================================================

interface AuditRow {
    audit_id: string
    company_id: string
    playbook_id: string
    template_id: string
    audit_name: string
    focus_categories: string[]
    status: string
    overall_score: number | null
    results: AlignmentReportResult | null
    created_at: string
    completed_at: string | null
}

// ============================================================================
// DOCX STYLING CONSTANTS
// ============================================================================

const COLORS = {
    primary: '4338CA',      // indigo-700
    success: '059669',      // emerald-600
    warning: 'D97706',      // amber-600
    danger: 'DC2626',       // red-600
    dark: '1E293B',         // slate-800
    medium: '475569',       // slate-600
    light: '94A3B8',        // slate-400
    border: 'CBD5E1',       // slate-300
    bgLight: 'F8FAFC',      // slate-50
    bgSuccess: 'ECFDF5',    // emerald-50
    bgWarning: 'FFFBEB',    // amber-50
    bgDanger: 'FEF2F2',     // red-50
    bgPrimary: 'EEF2FF',    // indigo-50
}

const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: COLORS.border }
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }

const CONTENT_WIDTH = 9360 // US Letter with 1" margins

// ============================================================================
// HELPER: Score color
// ============================================================================

function scoreColor(score: number): string {
    if (score >= 80) return COLORS.success
    if (score >= 60) return COLORS.warning
    return COLORS.danger
}

function scoreBg(score: number): string {
    if (score >= 80) return COLORS.bgSuccess
    if (score >= 60) return COLORS.bgWarning
    return COLORS.bgDanger
}

function tierFromScore(score: number): string {
    if (score >= 80) return 'Aligned'
    if (score >= 60) return 'Partially Aligned'
    return 'Material Gap'
}

// ============================================================================
// HELPER: Format date
// ============================================================================

function fmtDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ============================================================================
// DOCX BUILDER
// ============================================================================

function buildDocx(audit: AuditRow, report: AlignmentReportResult, playbookName: string, templateName: string, perspective: string): Document {
    const compliance = report.compliance
    const narrativeMap = new Map(report.narratives.map(n => [n.normalisedKey, n]))

    // Numbering config for bullet lists
    const numbering = {
        config: [
            {
                reference: 'findings',
                levels: [{
                    level: 0,
                    format: LevelFormat.BULLET,
                    text: '\u2022',
                    alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } },
                }],
            },
        ],
    }

    // ── Cover Section ──
    const coverChildren: (Paragraph | Table)[] = [
        // Spacer
        new Paragraph({ spacing: { before: 3000 }, children: [] }),
        // Title
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: 'Contract Alignment Report', size: 52, bold: true, color: COLORS.primary, font: 'Arial' })],
        }),
        // Audit name
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [new TextRun({ text: audit.audit_name, size: 28, color: COLORS.dark, font: 'Arial' })],
        }),
        // Score
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
            children: [
                new TextRun({ text: `Overall Alignment: `, size: 24, color: COLORS.medium, font: 'Arial' }),
                new TextRun({ text: `${compliance.overallScore}%`, size: 36, bold: true, color: scoreColor(compliance.overallScore), font: 'Arial' }),
                new TextRun({ text: `  (${tierFromScore(compliance.overallScore)})`, size: 24, color: scoreColor(compliance.overallScore), font: 'Arial' }),
            ],
        }),
        // Divider line
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.primary, space: 1 } },
            children: [],
        }),
        // Metadata
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
                new TextRun({ text: 'Template: ', size: 20, color: COLORS.light, font: 'Arial' }),
                new TextRun({ text: templateName, size: 20, bold: true, color: COLORS.dark, font: 'Arial' }),
            ],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
                new TextRun({ text: 'Playbook: ', size: 20, color: COLORS.light, font: 'Arial' }),
                new TextRun({ text: playbookName, size: 20, bold: true, color: COLORS.dark, font: 'Arial' }),
            ],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
                new TextRun({ text: 'Perspective: ', size: 20, color: COLORS.light, font: 'Arial' }),
                new TextRun({ text: perspective.charAt(0).toUpperCase() + perspective.slice(1), size: 20, color: COLORS.dark, font: 'Arial' }),
            ],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
                new TextRun({ text: 'Focus Categories: ', size: 20, color: COLORS.light, font: 'Arial' }),
                new TextRun({ text: `${report.focusCategories.length}`, size: 20, color: COLORS.dark, font: 'Arial' }),
                new TextRun({ text: `  |  Rules Assessed: `, size: 20, color: COLORS.light, font: 'Arial' }),
                new TextRun({ text: `${report.totalRulesInScope}`, size: 20, color: COLORS.dark, font: 'Arial' }),
            ],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
                new TextRun({ text: 'Date: ', size: 20, color: COLORS.light, font: 'Arial' }),
                new TextRun({ text: audit.completed_at ? fmtDate(audit.completed_at) : fmtDate(audit.created_at), size: 20, color: COLORS.dark, font: 'Arial' }),
            ],
        }),
        // Spacer then footer note
        new Paragraph({ spacing: { before: 2000 }, children: [] }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Generated by Clarence Legal Platform', size: 18, italics: true, color: COLORS.light, font: 'Arial' })],
        }),
    ]

    // ── Executive Summary Section ──
    const summaryChildren: (Paragraph | Table)[] = [
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 }, children: [new TextRun({ text: 'Executive Summary', font: 'Arial' })] }),
    ]

    if (report.executiveSummary) {
        summaryChildren.push(new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: report.executiveSummary, size: 22, color: COLORS.dark, font: 'Arial' })],
        }))
    }

    // Alignment snapshot table
    const aligned = report.alignedCount
    const partial = report.partialCount
    const gap = report.materialGapCount
    const colW = Math.floor(CONTENT_WIDTH / 3)

    summaryChildren.push(
        new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: 'Alignment Snapshot', size: 24, bold: true, color: COLORS.dark, font: 'Arial' })] }),
        new Table({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            columnWidths: [colW, colW, CONTENT_WIDTH - 2 * colW],
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            borders: noBorders,
                            width: { size: colW, type: WidthType.DXA },
                            shading: { fill: COLORS.bgSuccess, type: ShadingType.CLEAR },
                            margins: { top: 120, bottom: 120, left: 200, right: 200 },
                            children: [
                                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${aligned}`, size: 48, bold: true, color: COLORS.success, font: 'Arial' })] }),
                                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Aligned', size: 18, color: COLORS.success, font: 'Arial' })] }),
                                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(score \u2265 80%)', size: 16, color: COLORS.light, font: 'Arial' })] }),
                            ],
                        }),
                        new TableCell({
                            borders: noBorders,
                            width: { size: colW, type: WidthType.DXA },
                            shading: { fill: COLORS.bgWarning, type: ShadingType.CLEAR },
                            margins: { top: 120, bottom: 120, left: 200, right: 200 },
                            children: [
                                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${partial}`, size: 48, bold: true, color: COLORS.warning, font: 'Arial' })] }),
                                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Partially Aligned', size: 18, color: COLORS.warning, font: 'Arial' })] }),
                                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(60\u201379%)', size: 16, color: COLORS.light, font: 'Arial' })] }),
                            ],
                        }),
                        new TableCell({
                            borders: noBorders,
                            width: { size: CONTENT_WIDTH - 2 * colW, type: WidthType.DXA },
                            shading: { fill: COLORS.bgDanger, type: ShadingType.CLEAR },
                            margins: { top: 120, bottom: 120, left: 200, right: 200 },
                            children: [
                                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${gap}`, size: 48, bold: true, color: COLORS.danger, font: 'Arial' })] }),
                                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Material Gap', size: 18, color: COLORS.danger, font: 'Arial' })] }),
                                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(< 60%)', size: 16, color: COLORS.light, font: 'Arial' })] }),
                            ],
                        }),
                    ],
                }),
            ],
        }),
    )

    // ── Category Analysis Section ──
    // Sort: worst first
    const sortedCats = [...compliance.categories].sort((a, b) => a.score - b.score)

    const categoryChildren: (Paragraph | Table)[] = [
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 }, children: [new TextRun({ text: 'Category Analysis', font: 'Arial' })] }),
    ]

    for (const cat of sortedCats) {
        const narrative = narrativeMap.get(cat.normalisedKey)
        const tier = tierFromScore(cat.score)
        const color = scoreColor(cat.score)
        const bg = scoreBg(cat.score)

        // Category header row
        const headerColWidths = [6000, 3360]
        categoryChildren.push(
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: headerColWidths,
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                borders: noBorders,
                                width: { size: headerColWidths[0], type: WidthType.DXA },
                                shading: { fill: bg, type: ShadingType.CLEAR },
                                margins: { top: 100, bottom: 100, left: 200, right: 100 },
                                children: [new Paragraph({
                                    children: [
                                        new TextRun({ text: cat.name, size: 24, bold: true, color: COLORS.dark, font: 'Arial' }),
                                        new TextRun({ text: `  \u2014  ${tier}`, size: 20, color, font: 'Arial' }),
                                    ],
                                })],
                            }),
                            new TableCell({
                                borders: noBorders,
                                width: { size: headerColWidths[1], type: WidthType.DXA },
                                shading: { fill: bg, type: ShadingType.CLEAR },
                                margins: { top: 100, bottom: 100, left: 100, right: 200 },
                                children: [new Paragraph({
                                    alignment: AlignmentType.RIGHT,
                                    children: [
                                        new TextRun({ text: `${cat.score}%`, size: 28, bold: true, color, font: 'Arial' }),
                                        new TextRun({ text: `  (${cat.rulesPassed} pass / ${cat.rulesWarning} warn / ${cat.rulesFailed} fail)`, size: 16, color: COLORS.light, font: 'Arial' }),
                                    ],
                                })],
                            }),
                        ],
                    }),
                ],
            }),
        )

        // AI narrative: risk summary
        if (narrative) {
            categoryChildren.push(
                new Paragraph({
                    spacing: { before: 100, after: 60 },
                    children: [new TextRun({ text: 'Risk Assessment', size: 18, bold: true, color: COLORS.medium, font: 'Arial' })],
                }),
                new Paragraph({
                    spacing: { after: 100 },
                    children: [new TextRun({ text: narrative.riskSummary, size: 20, color: COLORS.dark, font: 'Arial' })],
                }),
            )

            // Key findings
            if (narrative.keyFindings.length > 0) {
                categoryChildren.push(
                    new Paragraph({
                        spacing: { before: 60, after: 60 },
                        children: [new TextRun({ text: 'Key Findings', size: 18, bold: true, color: COLORS.medium, font: 'Arial' })],
                    }),
                )
                for (const finding of narrative.keyFindings) {
                    categoryChildren.push(
                        new Paragraph({
                            numbering: { reference: 'findings', level: 0 },
                            children: [new TextRun({ text: finding, size: 20, color: COLORS.dark, font: 'Arial' })],
                        }),
                    )
                }
            }

            // Remediation
            categoryChildren.push(
                new Paragraph({
                    spacing: { before: 100, after: 60 },
                    children: [new TextRun({ text: 'Recommended Action', size: 18, bold: true, color: COLORS.medium, font: 'Arial' })],
                }),
                new Paragraph({
                    spacing: { after: 100 },
                    children: [new TextRun({ text: narrative.remediation, size: 20, color: COLORS.dark, font: 'Arial' })],
                }),
            )
        }

        // Rule detail table
        if (cat.rules.length > 0) {
            const ruleColWidths = [3500, 1800, 1800, 2260]
            const headerRow = new TableRow({
                children: [
                    makeHeaderCell('Clause', ruleColWidths[0]),
                    makeHeaderCell('Playbook Range', ruleColWidths[1]),
                    makeHeaderCell('Template Pos.', ruleColWidths[2]),
                    makeHeaderCell('Status', ruleColWidths[3]),
                ],
            })

            const ruleRows = cat.rules.map(scored => {
                const statusLabel = scored.status === 'pass' ? 'Aligned' :
                    scored.status === 'fail' || scored.status === 'breach' ? 'Misaligned' :
                    scored.status === 'warning' || scored.status === 'acceptable' ? 'Partial' :
                    scored.status === 'excluded' ? 'No data' : scored.status
                const statusColor = scored.status === 'pass' ? COLORS.success :
                    scored.status === 'fail' || scored.status === 'breach' ? COLORS.danger :
                    scored.status === 'warning' || scored.status === 'acceptable' ? COLORS.warning : COLORS.light

                return new TableRow({
                    children: [
                        makeBodyCell(
                            scored.rule.clause_code ? `${scored.rule.clause_code} ${scored.rule.clause_name}` : scored.rule.clause_name,
                            ruleColWidths[0],
                        ),
                        makeBodyCell(
                            `${scored.rule.minimum_position}\u2013${scored.rule.maximum_position} (ideal ${scored.rule.ideal_position})`,
                            ruleColWidths[1],
                        ),
                        makeBodyCell(
                            scored.effectivePosition != null ? `${scored.effectivePosition}` : '\u2014',
                            ruleColWidths[2],
                        ),
                        makeBodyCellColored(statusLabel, ruleColWidths[3], statusColor),
                    ],
                })
            })

            categoryChildren.push(
                new Paragraph({ spacing: { before: 100, after: 60 }, children: [new TextRun({ text: 'Rule Details', size: 18, bold: true, color: COLORS.medium, font: 'Arial' })] }),
                new Table({
                    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                    columnWidths: ruleColWidths,
                    rows: [headerRow, ...ruleRows],
                }),
            )
        }

        // Spacer between categories
        categoryChildren.push(new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }))
    }

    // ── Red Lines Section ──
    const redLineChildren: (Paragraph | Table)[] = []
    if (compliance.redLines.length > 0) {
        redLineChildren.push(
            new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 }, children: [new TextRun({ text: 'Red Lines & Deal Breakers', font: 'Arial' })] }),
        )

        const rlColWidths = [4000, 1500, 1500, 2360]
        const rlHeader = new TableRow({
            children: [
                makeHeaderCell('Clause', rlColWidths[0]),
                makeHeaderCell('Type', rlColWidths[1]),
                makeHeaderCell('Position', rlColWidths[2]),
                makeHeaderCell('Status', rlColWidths[3]),
            ],
        })

        const rlRows = compliance.redLines.map(rl => {
            const typeLabel = rl.rule.is_deal_breaker ? 'Deal Breaker' : 'Non-Negotiable'
            const statusText = rl.status === 'breach' ? 'BREACHED' : 'Clear'
            const statusClr = rl.status === 'breach' ? COLORS.danger : COLORS.success

            return new TableRow({
                children: [
                    makeBodyCell(rl.rule.clause_name, rlColWidths[0]),
                    makeBodyCell(typeLabel, rlColWidths[1]),
                    makeBodyCell(rl.effectivePosition != null ? `${rl.effectivePosition}` : '\u2014', rlColWidths[2]),
                    makeBodyCellColored(statusText, rlColWidths[3], statusClr),
                ],
            })
        })

        redLineChildren.push(
            new Table({
                width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                columnWidths: rlColWidths,
                rows: [rlHeader, ...rlRows],
            }),
        )

        const breaches = compliance.redLines.filter(r => r.status === 'breach')
        if (breaches.length > 0) {
            redLineChildren.push(
                new Paragraph({
                    spacing: { before: 200 },
                    children: [
                        new TextRun({ text: `\u26A0  ${breaches.length} red line breach${breaches.length > 1 ? 'es' : ''} identified. `, size: 20, bold: true, color: COLORS.danger, font: 'Arial' }),
                        new TextRun({ text: 'These require immediate escalation before contract execution.', size: 20, color: COLORS.dark, font: 'Arial' }),
                    ],
                }),
            )
        }
    }

    // ── Build Document ──
    const doc = new Document({
        numbering,
        styles: {
            default: { document: { run: { font: 'Arial', size: 22 } } },
            paragraphStyles: [
                {
                    id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { size: 32, bold: true, font: 'Arial', color: COLORS.primary },
                    paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 },
                },
                {
                    id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { size: 28, bold: true, font: 'Arial', color: COLORS.dark },
                    paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 },
                },
            ],
        },
        sections: [
            // Cover page
            {
                properties: {
                    page: {
                        size: { width: 12240, height: 15840 },
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                    },
                },
                children: coverChildren,
            },
            // Executive Summary + Snapshot
            {
                properties: {
                    page: {
                        size: { width: 12240, height: 15840 },
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                    },
                },
                headers: {
                    default: new Header({
                        children: [new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [new TextRun({ text: audit.audit_name, size: 16, color: COLORS.light, italics: true, font: 'Arial' })],
                        })],
                    }),
                },
                footers: {
                    default: new Footer({
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: 'Page ', size: 16, color: COLORS.light, font: 'Arial' }),
                                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: COLORS.light, font: 'Arial' }),
                                new TextRun({ text: '  |  Clarence Legal Platform', size: 16, color: COLORS.light, font: 'Arial' }),
                            ],
                        })],
                    }),
                },
                children: summaryChildren,
            },
            // Category Analysis
            {
                properties: {
                    page: {
                        size: { width: 12240, height: 15840 },
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                    },
                },
                headers: {
                    default: new Header({
                        children: [new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [new TextRun({ text: audit.audit_name, size: 16, color: COLORS.light, italics: true, font: 'Arial' })],
                        })],
                    }),
                },
                footers: {
                    default: new Footer({
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: 'Page ', size: 16, color: COLORS.light, font: 'Arial' }),
                                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: COLORS.light, font: 'Arial' }),
                                new TextRun({ text: '  |  Clarence Legal Platform', size: 16, color: COLORS.light, font: 'Arial' }),
                            ],
                        })],
                    }),
                },
                children: categoryChildren,
            },
            // Red Lines (if any)
            ...(redLineChildren.length > 0 ? [{
                properties: {
                    page: {
                        size: { width: 12240, height: 15840 },
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                    },
                },
                headers: {
                    default: new Header({
                        children: [new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [new TextRun({ text: audit.audit_name, size: 16, color: COLORS.light, italics: true, font: 'Arial' })],
                        })],
                    }),
                },
                footers: {
                    default: new Footer({
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: 'Page ', size: 16, color: COLORS.light, font: 'Arial' }),
                                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: COLORS.light, font: 'Arial' }),
                                new TextRun({ text: '  |  Clarence Legal Platform', size: 16, color: COLORS.light, font: 'Arial' }),
                            ],
                        })],
                    }),
                },
                children: redLineChildren,
            }] : []),
        ],
    })

    return doc
}

// ============================================================================
// TABLE CELL HELPERS
// ============================================================================

function makeHeaderCell(text: string, width: number): TableCell {
    return new TableCell({
        borders,
        width: { size: width, type: WidthType.DXA },
        shading: { fill: COLORS.bgPrimary, type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({
            children: [new TextRun({ text, size: 18, bold: true, color: COLORS.primary, font: 'Arial' })],
        })],
    })
}

function makeBodyCell(text: string, width: number): TableCell {
    return new TableCell({
        borders,
        width: { size: width, type: WidthType.DXA },
        margins: { top: 40, bottom: 40, left: 100, right: 100 },
        children: [new Paragraph({
            children: [new TextRun({ text, size: 18, color: COLORS.dark, font: 'Arial' })],
        })],
    })
}

function makeBodyCellColored(text: string, width: number, color: string): TableCell {
    return new TableCell({
        borders,
        width: { size: width, type: WidthType.DXA },
        margins: { top: 40, bottom: 40, left: 100, right: 100 },
        children: [new Paragraph({
            children: [new TextRun({ text, size: 18, bold: true, color, font: 'Arial' })],
        })],
    })
}

// ============================================================================
// PDF BUILDER (using pdfkit)
// ============================================================================

async function buildPdf(audit: AuditRow, report: AlignmentReportResult, playbookName: string, templateName: string, perspective: string): Promise<Buffer> {
    // Dynamic import for pdfkit (CommonJS module)
    const PDFDocument = (await import('pdfkit')).default

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'LETTER',
            margins: { top: 72, bottom: 72, left: 72, right: 72 },
            bufferPages: true,
            info: {
                Title: audit.audit_name,
                Author: 'Clarence Legal Platform',
                Subject: 'Contract Alignment Report',
            },
        })

        const chunks: Buffer[] = []
        doc.on('data', (chunk: Buffer) => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        const compliance = report.compliance
        const narrativeMap = new Map(report.narratives.map(n => [n.normalisedKey, n]))
        const pageW = 612 - 144 // letter width minus margins

        // ── Cover Page ──
        doc.moveDown(6)
        doc.font('Helvetica-Bold').fontSize(26).fillColor('#4338CA')
            .text('Contract Alignment Report', { align: 'center' })
        doc.moveDown(0.5)
        doc.font('Helvetica').fontSize(14).fillColor('#1E293B')
            .text(audit.audit_name, { align: 'center' })
        doc.moveDown(1)

        // Score
        const sColor = compliance.overallScore >= 80 ? '#059669' : compliance.overallScore >= 60 ? '#D97706' : '#DC2626'
        doc.font('Helvetica-Bold').fontSize(36).fillColor(sColor)
            .text(`${compliance.overallScore}%`, { align: 'center' })
        doc.font('Helvetica').fontSize(12).fillColor(sColor)
            .text(tierFromScore(compliance.overallScore), { align: 'center' })
        doc.moveDown(2)

        // Metadata
        doc.font('Helvetica').fontSize(10).fillColor('#475569')
        doc.text(`Template: ${templateName}`, { align: 'center' })
        doc.text(`Playbook: ${playbookName}`, { align: 'center' })
        doc.text(`Perspective: ${perspective.charAt(0).toUpperCase() + perspective.slice(1)}`, { align: 'center' })
        doc.text(`Categories: ${report.focusCategories.length}  |  Rules: ${report.totalRulesInScope}`, { align: 'center' })
        doc.text(`Date: ${audit.completed_at ? fmtDate(audit.completed_at) : fmtDate(audit.created_at)}`, { align: 'center' })

        doc.moveDown(6)
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#94A3B8')
            .text('Generated by Clarence Legal Platform', { align: 'center' })

        // ── Executive Summary ──
        doc.addPage()
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#4338CA')
            .text('Executive Summary')
        doc.moveDown(0.5)
        if (report.executiveSummary) {
            doc.font('Helvetica').fontSize(11).fillColor('#1E293B')
                .text(report.executiveSummary, { lineGap: 3 })
        }
        doc.moveDown(1)

        // Snapshot
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#1E293B')
            .text('Alignment Snapshot')
        doc.moveDown(0.5)

        const boxW = pageW / 3 - 8
        const boxY = doc.y
        const boxH = 60
        // Aligned box
        doc.roundedRect(72, boxY, boxW, boxH, 4).fill('#ECFDF5')
        doc.font('Helvetica-Bold').fontSize(22).fillColor('#059669')
            .text(`${report.alignedCount}`, 72, boxY + 8, { width: boxW, align: 'center' })
        doc.font('Helvetica').fontSize(8).fillColor('#059669')
            .text('Aligned (\u226580%)', 72, boxY + 36, { width: boxW, align: 'center' })

        // Partial box
        const box2X = 72 + boxW + 12
        doc.roundedRect(box2X, boxY, boxW, boxH, 4).fill('#FFFBEB')
        doc.font('Helvetica-Bold').fontSize(22).fillColor('#D97706')
            .text(`${report.partialCount}`, box2X, boxY + 8, { width: boxW, align: 'center' })
        doc.font('Helvetica').fontSize(8).fillColor('#D97706')
            .text('Partial (60\u201379%)', box2X, boxY + 36, { width: boxW, align: 'center' })

        // Gap box
        const box3X = box2X + boxW + 12
        doc.roundedRect(box3X, boxY, boxW, boxH, 4).fill('#FEF2F2')
        doc.font('Helvetica-Bold').fontSize(22).fillColor('#DC2626')
            .text(`${report.materialGapCount}`, box3X, boxY + 8, { width: boxW, align: 'center' })
        doc.font('Helvetica').fontSize(8).fillColor('#DC2626')
            .text('Material Gap (<60%)', box3X, boxY + 36, { width: boxW, align: 'center' })

        doc.y = boxY + boxH + 20

        // ── Category Analysis ──
        doc.addPage()
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#4338CA')
            .text('Category Analysis')
        doc.moveDown(0.5)

        const sortedCats = [...compliance.categories].sort((a, b) => a.score - b.score)
        for (const cat of sortedCats) {
            const narrative = narrativeMap.get(cat.normalisedKey)
            const clr = cat.score >= 80 ? '#059669' : cat.score >= 60 ? '#D97706' : '#DC2626'

            // Check if we need a new page (at least 120pt of space)
            if (doc.y > 620) doc.addPage()

            // Category header
            doc.font('Helvetica-Bold').fontSize(13).fillColor('#1E293B')
                .text(`${cat.name}`, { continued: true })
            doc.font('Helvetica-Bold').fontSize(13).fillColor(clr)
                .text(`  ${cat.score}%  ${tierFromScore(cat.score)}`)

            doc.font('Helvetica').fontSize(8).fillColor('#94A3B8')
                .text(`${cat.rulesPassed} aligned \u00B7 ${cat.rulesWarning} partial \u00B7 ${cat.rulesFailed} misaligned of ${cat.rulesTotal} rules`)
            doc.moveDown(0.3)

            if (narrative) {
                doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text('Risk Assessment')
                doc.font('Helvetica').fontSize(10).fillColor('#1E293B').text(narrative.riskSummary, { lineGap: 2 })
                doc.moveDown(0.2)

                if (narrative.keyFindings.length > 0) {
                    doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text('Key Findings')
                    for (const f of narrative.keyFindings) {
                        doc.font('Helvetica').fontSize(10).fillColor('#1E293B').text(`\u2022  ${f}`, { indent: 12, lineGap: 1 })
                    }
                    doc.moveDown(0.2)
                }

                doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text('Recommended Action')
                doc.font('Helvetica').fontSize(10).fillColor('#1E293B').text(narrative.remediation, { lineGap: 2 })
            }

            doc.moveDown(0.5)
            // Light divider
            doc.moveTo(72, doc.y).lineTo(72 + pageW, doc.y).strokeColor('#E2E8F0').lineWidth(0.5).stroke()
            doc.moveDown(0.5)
        }

        // ── Red Lines ──
        if (compliance.redLines.length > 0) {
            if (doc.y > 550) doc.addPage()
            doc.font('Helvetica-Bold').fontSize(18).fillColor('#4338CA')
                .text('Red Lines & Deal Breakers')
            doc.moveDown(0.5)

            for (const rl of compliance.redLines) {
                const rlClr = rl.status === 'breach' ? '#DC2626' : '#059669'
                const typeLabel = rl.rule.is_deal_breaker ? 'Deal Breaker' : 'Non-Negotiable'
                doc.font('Helvetica-Bold').fontSize(10).fillColor(rlClr)
                    .text(`${rl.status === 'breach' ? '\u26A0' : '\u2713'}  ${rl.rule.clause_name}`, { continued: true })
                doc.font('Helvetica').fontSize(9).fillColor('#475569')
                    .text(`  (${typeLabel})`)
                if (rl.detail) {
                    doc.font('Helvetica').fontSize(9).fillColor('#475569').text(rl.detail, { indent: 18 })
                }
                doc.moveDown(0.3)
            }
        }

        // Add page numbers
        const pages = doc.bufferedPageRange()
        for (let i = pages.start; i < pages.start + pages.count; i++) {
            doc.switchToPage(i)
            doc.font('Helvetica').fontSize(8).fillColor('#94A3B8')
                .text(
                    `Page ${i + 1}  |  Clarence Legal Platform`,
                    72, 720, { width: pageW, align: 'center' },
                )
        }

        doc.end()
    })
}

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ auditId: string }> }
) {
    const { auditId } = await params
    const format = request.nextUrl.searchParams.get('format') || 'docx'

    if (format !== 'docx' && format !== 'pdf') {
        return NextResponse.json({ error: 'Invalid format. Use ?format=docx or ?format=pdf' }, { status: 400 })
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Fetch audit with joins
        const { data: audit, error } = await supabase
            .from('alignment_audits')
            .select('*')
            .eq('audit_id', auditId)
            .single()

        if (error || !audit) {
            return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
        }

        if (audit.status !== 'complete' || !audit.results) {
            return NextResponse.json({ error: 'Audit has not been completed yet' }, { status: 400 })
        }

        // Get playbook and template names
        const [{ data: playbook }, { data: template }] = await Promise.all([
            supabase.from('playbooks').select('playbook_name, perspective').eq('playbook_id', audit.playbook_id).single(),
            supabase.from('contract_templates').select('template_name').eq('template_id', audit.template_id).single(),
        ])

        const playbookName = playbook?.playbook_name || 'Unknown Playbook'
        const templateName = template?.template_name || 'Unknown Template'
        const perspective = playbook?.perspective || 'customer'
        const report = audit.results as AlignmentReportResult

        // Safe filename
        const safeName = audit.audit_name.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_')

        if (format === 'docx') {
            const doc = buildDocx(audit as AuditRow, report, playbookName, templateName, perspective)
            const buffer = await Packer.toBuffer(doc)

            return new NextResponse(new Uint8Array(buffer), {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'Content-Disposition': `attachment; filename="${safeName}.docx"`,
                },
            })
        } else {
            const buffer = await buildPdf(audit as AuditRow, report, playbookName, templateName, perspective)

            return new NextResponse(new Uint8Array(buffer), {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
                },
            })
        }
    } catch (err) {
        console.error('Export error:', err)
        return NextResponse.json({ error: 'Export failed' }, { status: 500 })
    }
}
