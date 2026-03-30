// ============================================================================
// FILE: app/api/contracts/parse-chunked/route.ts
// PURPOSE: Server-side chunked document parsing for large contracts
//          Splits document text into manageable chunks, calls AI for each,
//          writes clauses to DB, and updates contract status.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

// Extend Vercel function timeout to maximum (Pro: 300s)
export const maxDuration = 300

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const anthropicApiKey = process.env.ANTHROPIC_API_KEY!

// Maximum characters per chunk sent to AI
const CHUNK_SIZE = 30000
// Overlap between chunks to avoid splitting clauses at boundaries
const CHUNK_OVERLAP = 2000

// ============================================================================
// TYPES
// ============================================================================

interface ParsedClause {
    clause_number: string | null
    clause_name: string
    category: string
    content: string
    is_header: boolean
    ai_suggested_category: string
    ai_confidence: number
}

interface ChunkResult {
    clauses: ParsedClause[]
    chunkIndex: number
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Split document text into overlapping chunks at natural boundaries
 * (paragraph breaks, section headings).
 */
function splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    if (text.length <= chunkSize) return [text]

    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length)

        // If not at the end, try to break at a paragraph boundary
        if (end < text.length) {
            // Look backwards from the end for a good break point
            const searchFrom = Math.max(end - 3000, start + chunkSize / 2)
            const breakZone = text.slice(searchFrom, end)

            // Priority: double newline (paragraph break)
            const doubleNl = breakZone.lastIndexOf('\n\n')
            if (doubleNl !== -1) {
                end = searchFrom + doubleNl + 2
            } else {
                // Fallback: single newline
                const singleNl = breakZone.lastIndexOf('\n')
                if (singleNl !== -1) {
                    end = searchFrom + singleNl + 1
                }
                // Otherwise just cut at chunkSize
            }
        }

        chunks.push(text.slice(start, end))

        // Next chunk starts with overlap to catch split clauses
        start = Math.max(start + 1, end - overlap)

        // Safety: avoid infinite loop if we're not making progress
        if (start <= chunks.length && chunks.length > 1 && end === start) {
            start = end
        }
    }

    return chunks
}

/**
 * Call Anthropic to extract clauses from a chunk of contract text.
 */
async function parseChunk(
    client: Anthropic,
    chunkText: string,
    chunkIndex: number,
    totalChunks: number,
    contractType: string,
    existingClauseNumbers: Set<string>,
): Promise<ParsedClause[]> {
    const systemPrompt = `You are a legal contract parser. Your task is to extract individual clauses from a section of a legal contract document.

For each clause you identify, provide:
- clause_number: The clause/section number (e.g., "1", "1.1", "2.3.4", "Schedule 1"). Use null if no number is visible.
- clause_name: A descriptive name for the clause (e.g., "Definitions", "Term and Termination", "Liability Cap")
- category: One of these categories: Definitions, General, Service, Service Levels, Charges and Payment, Liability and Indemnity, Term and Termination, Intellectual Property, Confidentiality, Data Protection, Insurance, Dispute Resolution, Force Majeure, Governance, Personnel, Compliance, Audit Rights, Change Control, Other
- content: The full text of the clause (preserve original wording)
- is_header: true if this is a section heading with no substantive content (just introduces a numbered section), false if it contains actual contractual terms
- ai_suggested_category: Same as category (your best guess)
- ai_confidence: Your confidence in the categorisation (0.0 to 1.0)

Important rules:
- Preserve the EXACT original text in the content field — do not summarise or paraphrase
- Include sub-clauses as separate entries (e.g., 1.1, 1.2, 1.2.1)
- If a clause spans multiple paragraphs, include all paragraphs in the content
- For Schedule sections, prefix the clause_number with "Sch" (e.g., "Sch1", "Sch1.1")
- Contract type is: ${contractType}
${totalChunks > 1 ? `\n- This is chunk ${chunkIndex + 1} of ${totalChunks}. Some clauses may be split across chunks.` : ''}
${existingClauseNumbers.size > 0 ? `\n- These clause numbers have already been parsed from previous chunks, so SKIP them if you encounter them: ${[...existingClauseNumbers].slice(-30).join(', ')}` : ''}

Respond with a JSON array of clause objects. No markdown, no explanation — just the JSON array.`

    const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{
            role: 'user',
            content: `Extract all clauses from this section of a legal contract:\n\n${chunkText}`,
        }],
        system: systemPrompt,
    })

    // Extract text from response
    const responseText = response.content
        .filter(block => block.type === 'text')
        .map(block => block.type === 'text' ? block.text : '')
        .join('')

    // Parse JSON response
    try {
        // Handle potential markdown wrapping
        let jsonStr = responseText.trim()
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
        }
        const clauses = JSON.parse(jsonStr) as ParsedClause[]
        return Array.isArray(clauses) ? clauses : []
    } catch (err) {
        console.error(`[parse-chunked] Failed to parse AI response for chunk ${chunkIndex}:`, err)
        console.error('[parse-chunked] Response was:', responseText.slice(0, 500))
        return []
    }
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            document_text,
            file_name,
            file_type,
            file_size,
            template_name,
            contract_type,
            user_id,
            company_id,
            contract_id: existingContractId,
        } = body

        if (!document_text || document_text.length < 100) {
            return NextResponse.json({ error: 'Insufficient document text' }, { status: 400 })
        }
        if (!user_id) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)
        const anthropic = new Anthropic({ apiKey: anthropicApiKey })

        console.log(`[parse-chunked] Starting parse: ${file_name}, ${document_text.length} chars, type=${contract_type}`)

        // ── Step 1: Create or fetch the contract record ──
        let contractId = existingContractId

        if (!contractId) {
            // Create the uploaded_contract record
            const { data: contract, error: createErr } = await supabase
                .from('uploaded_contracts')
                .insert({
                    user_id,
                    company_id: company_id || null,
                    file_name: file_name || 'Untitled',
                    file_type: file_type || 'pdf',
                    file_size: file_size || 0,
                    status: 'processing',
                    template_name: template_name || file_name?.replace(/\.[^.]+$/, '') || 'Untitled',
                    contract_type: contract_type || 'custom',
                    is_template: true,
                    document_text: document_text,
                })
                .select('contract_id')
                .single()

            if (createErr || !contract) {
                console.error('[parse-chunked] Failed to create contract:', createErr)
                return NextResponse.json({ error: 'Failed to create contract record', detail: createErr?.message }, { status: 500 })
            }
            contractId = contract.contract_id
        } else {
            // Update existing contract to processing
            await supabase
                .from('uploaded_contracts')
                .update({ status: 'processing', document_text })
                .eq('contract_id', contractId)
        }

        console.log(`[parse-chunked] Contract ID: ${contractId}`)

        // ── Step 2: Process all chunks inline ──
        // With maxDuration=300, we have up to 5 minutes for processing.
        // The client already has the contract ID from the N8N-style flow,
        // but here we process everything and return when done.
        // Client polling will see clauses appearing in real-time.
        try {
            const chunks = splitIntoChunks(document_text, CHUNK_SIZE, CHUNK_OVERLAP)
            console.log(`[parse-chunked] Split into ${chunks.length} chunks`)

            const allClauses: ParsedClause[] = []
            const seenClauseNumbers = new Set<string>()
            let displayOrder = 1

            for (let i = 0; i < chunks.length; i++) {
                console.log(`[parse-chunked] Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`)

                const chunkClauses = await parseChunk(
                    anthropic,
                    chunks[i],
                    i,
                    chunks.length,
                    contract_type || 'custom',
                    seenClauseNumbers,
                )

                // De-duplicate: skip clauses with numbers we've already seen
                const newClauses = chunkClauses.filter(c => {
                    if (c.clause_number && seenClauseNumbers.has(c.clause_number)) {
                        return false
                    }
                    if (c.clause_number) seenClauseNumbers.add(c.clause_number)
                    return true
                })

                // Write this batch to DB immediately (so polling shows progress)
                if (newClauses.length > 0) {
                    const rows = newClauses.map(c => ({
                        contract_id: contractId,
                        clause_number: c.clause_number || null,
                        clause_name: c.clause_name || 'Untitled',
                        category: c.category || 'Other',
                        content: c.content || '',
                        original_text: c.content || '',
                        is_header: c.is_header || false,
                        display_order: displayOrder++,
                        ai_suggested_category: c.ai_suggested_category || c.category || 'Other',
                        ai_suggested_name: c.clause_name || null,
                        ai_confidence: c.ai_confidence || 0.7,
                        status: 'pending',
                    }))

                    const { error: insertErr } = await supabase
                        .from('uploaded_contract_clauses')
                        .insert(rows)

                    if (insertErr) {
                        console.error(`[parse-chunked] Insert error for chunk ${i}:`, insertErr)
                    } else {
                        console.log(`[parse-chunked] Inserted ${rows.length} clauses from chunk ${i + 1}`)
                    }

                    for (const c of newClauses) {
                        allClauses.push(c)
                    }
                }
            }

            // ── Step 3: Mark contract as ready ──
            await supabase
                .from('uploaded_contracts')
                .update({
                    status: 'ready',
                    clause_count: allClauses.length,
                })
                .eq('contract_id', contractId)

            console.log(`[parse-chunked] Complete: ${allClauses.length} clauses for contract ${contractId}`)

            return NextResponse.json({
                success: true,
                contractId,
                contract_id: contractId,
                status: 'processing', // Client expects 'processing' to start polling
                clauseCount: allClauses.length,
                chunks: chunks.length,
            })

        } catch (processErr) {
            console.error('[parse-chunked] Processing error:', processErr)
            await supabase
                .from('uploaded_contracts')
                .update({ status: 'failed' })
                .eq('contract_id', contractId)

            // Still return the contract ID so the client can see the failure
            return NextResponse.json({
                success: false,
                contractId,
                contract_id: contractId,
                status: 'processing',
                error: processErr instanceof Error ? processErr.message : 'Processing failed',
            })
        }

    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[parse-chunked] Route error:', message)
        return NextResponse.json({ error: 'Parse failed', detail: message }, { status: 500 })
    }
}
