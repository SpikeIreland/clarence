

CLARENCE
The Honest Broker
HANDOVER DOCUMENT
Contract Create — Studio Intelligence Layer

This handover specifies the Studio Intelligence Layer for the Contract Create pathway: a dedicated context agent that gives CLARENCE full situational awareness at every stage of the studio journey — from Solo Prep through to Active Negotiation. It documents the current broken state, the target architecture, and the implementation plan.


6 March 2026
Version 1.0
Clarence Legal Limited  |  Confidential
Sources: HANDOVER-Contract-Create-Pathway  |  CLARENCE-AI-Context-Audit-Strategy  |  FOCUS-23  |  HANDOVER-Contract-Studio-Consolidation  |  THE-CLARENCE-BIBLE-V1_2
 
1. The Problem: CLARENCE is Context-Blind at the Studio Entrance
When a user arrives at the Contract Studio in the Contract Create pathway, CLARENCE currently does nothing. There is no welcome message, no situational awareness, and no guidance. The clause chat panel is empty. The user is left to navigate the studio unaided.

The console log from the initial diagnosis session tells the story:

Error fetching clause chat: SyntaxError: Unexpected end of JSON input
[SoloPrep] Loaded 74 uploaded clauses
Realtime subscription status: SUBSCRIBED
// No welcome message triggered. No CLARENCE response. Studio silent.

There are two compounding failures:

•	Empty response bug: The clause-chat-api-get workflow returns an empty body (not an empty array []) when there are no messages. The frontend JSON parser throws on this, and the error disrupts the chat initialisation sequence — preventing the welcome call from firing.
•	No welcome trigger: Even if the fetch succeeded, nothing calls clarence-ai with a welcome prompt on studio load. CLARENCE has no mechanism to greet the user, assess the current state, or explain what mode they are in.

Behind both failures is the deeper architectural issue: CLARENCE has no Studio Intelligence Layer. It does not know:
•	What mode the studio is in (Solo Prep / Waiting / Active Negotiation / Near Agreement)
•	Whether leverage has been calculated
•	What the source document actually says — clause text is never fetched into the AI context
•	What the position labels mean (position 7 on Payment Terms = what exactly?)
•	What the company Playbook says about the clauses being discussed

The result: CLARENCE cannot give meaningful advice in the Contract Studio. It either stays silent or, when prompted, invents contract terms that do not match the uploaded document. This is the primary quality problem for the Contract Create pathway.

2. The Target State: A Situationally Aware Studio Agent
2.1 Studio Modes
The Contract Studio operates in four distinct modes. CLARENCE must behave differently in each:

Mode	Trigger Condition	What CLARENCE Knows	CLARENCE's Posture
Solo Prep	Provider not yet invited, or invited but not started	Initiator's document, their strategic assessment, Playbook rules. No leverage, no provider positions.	Exploratory advisor. References document wording directly. Applies Playbook. Prefixes advice as provisional.
Waiting	Provider invited and in progress but not complete	All of Solo Prep. Provider has started but not finished.	Same as Solo Prep but acknowledges provider is en route. Can prepare the initiator for what's coming.
Active Negotiation	Both parties complete. Leverage calculated. Positions generated.	Full context: leverage scores, three positions per clause, position labels, both parties' strategic inputs.	Full mediator. References leverage balance. Gives position-specific advice grounded in actual clause language.
Near Agreement	Alignment percentage above threshold (e.g. 80%+)	All of Active Negotiation plus clause agreement statuses.	Deal-closer. Highlights remaining gaps. Encourages convergence. Flags Red Lines.

2.2 The Solo Prep Experience (Immediate Priority)
Solo Prep is the mode most users will encounter first, and the one currently most broken. The target experience is:

•	User arrives at Contract Studio. CLARENCE immediately sends a welcome message explaining: 'I've loaded your document [name]. The provider hasn't completed their assessment yet, so I'm working from your document wording and your Playbook. My advice at this stage is provisional — once [provider] completes their assessment, I'll have their positions and leverage data to work with.'
•	User clicks on a clause. CLARENCE explains what the document says, identifies the category, and applies any relevant Playbook rules — explicitly labelling the advice as provisional.
•	User asks a general strategy question. CLARENCE answers in the context of what it knows — the deal context, the initiator's strategic assessment, and the Playbook — while being clear about what it does not yet know.
•	Provider completes their journey. The studio activates. CLARENCE sends a new message: 'Great news — [provider] has completed their assessment. I now have both parties' strategic inputs and have calculated the leverage balance. Let me walk you through what's changed...'

The key principle: CLARENCE must always be honest about the completeness of its information. Provisional advice labelled as provisional is better than silence. Silence is never acceptable.

2.3 The Context Object CLARENCE Needs
Every CLARENCE interaction in the Contract Studio must be preceded by a context fetch that assembles the following:

Context Section	Source Table(s)	Available In	Currently Fetched?
Studio mode	sessions.status + leverage_calculations existence	All modes	No
Session core	sessions, provider_bids	All modes	Yes
Deal context	sessions (deal_value, contract_type, duration, parties)	All modes	Yes (partial)
Source clause content	uploaded_contract_clauses.clause_text OR template_clauses	All modes	NO — Critical Gap
Position labels	clause_range_mappings (position_1_label … position_10_label)	All modes	Only when clauseId provided
Leverage scores	leverage_calculations	Active Negotiation+	Yes
Three positions	session_clause_positions	Active Negotiation+	Yes
Playbook rules	playbook_rules, company_playbooks	All modes (if exists)	Yes
Party strategic inputs	customer_requirements, provider_bids	Active Negotiation+	Partial
Chat history	clause_chat_messages	All modes	Yes (broken by empty bug)
Biggest gaps	session_clause_positions (calculated)	Active Negotiation+	Yes

3. Current Workflow Audit: What Exists, What's Broken
3.1 clause-chat-api-get (Workflow 3.3) — Bug Fix Required
This workflow fetches clause chat history for a given session_id and optional position_id. It has a critical bug in the response node.

The Bug
When there are zero messages, the Format Response code node returns an empty array. However, the Respond to Webhook node reads $json from a node with no items — it sends an empty response body rather than []. The frontend receives nothing, attempts JSON.parse(''), and throws SyntaxError: Unexpected end of JSON input. This error disrupts the chat initialisation sequence.

The Fix
The Respond to Webhook node must be changed to always return a valid JSON array. Replace the current response body with:

// In Respond to Webhook node, change responseBody to:
={{ JSON.stringify($input.all().map(i => i.json)) }}
 
// This always returns [] when empty, never an empty body.

Secondary Fix — Format Response Node
Also update the Format Response node to handle the empty case explicitly:

const items = $input.all();
if (!items || items.length === 0) {
  return [{ json: [] }];
}
const messages = items.map(item => ({
  messageId: item.json.message_id,
  sessionId: item.json.session_id,
  positionId: item.json.position_id,
  sender: item.json.sender,
  senderUserId: item.json.sender_user_id,
  message: item.json.message,
  messageType: item.json.message_type,
  relatedPositionChange: item.json.related_position_change,
  triggeredBy: item.json.triggered_by,
  createdAt: item.json.created_at
}));
return [{ json: messages }];

3.2 strategic-assessment Webhook — 500 Error
The console log shows: spikeislandstudios.app.n8n.cloud/webhook/strategic-assessment returned status 500. This means the strategic assessment is failing silently — users are being routed onwards to the studio without having completed (or saved) their assessment. This means leverage can never be calculated correctly. Diagnosis should include: checking the N8N execution log for the strategic-assessment workflow, verifying the customer_requirements table schema matches what the workflow writes, and confirming the session_id is passed correctly from create-contract.

3.3 clarence-context-builder — Critical Gaps
The context builder is the foundation of CLARENCE's awareness. It currently fetches: session core, leverage, positions overview, chat history, recent moves, Playbook context, and customer/provider insights. It does NOT fetch:
•	Studio mode — it does not determine whether leverage has been calculated or whether the provider has completed
•	Source clause content — uploaded_contract_clauses.clause_text is never included
•	Position labels for all clauses — only fetched when a specific clauseId is provided

These three gaps are the root cause of CLARENCE's context blindness in the Contract Studio.

3.4 clarence-ai — No Welcome Trigger
The clarence-ai workflow handles all CLARENCE interactions in the Contract Studio. It supports prompt types: welcome, clause_explain, chat, position_change, alignment_reached, recommendation_adopted. The welcome prompt type exists but is never called on studio load. The frontend contract-studio.tsx does not trigger a welcome call when the component mounts. This must be added.

4. Implementation Plan
4.1 Phase 1 — Fix the Broken Baseline (Do First)

#	Task	Workflow / File	Effort	Impact
1	Fix clause-chat-api-get empty response bug	3.3 Clause Chat API GET	30 min	Critical — unblocks chat init
2	Diagnose strategic-assessment 500 error	strategic-assessment webhook	1 hr	Critical — without this, leverage never fires
3	Add studio load welcome trigger to frontend	contract-studio.tsx	1 hr	Critical — CLARENCE currently silent on entry
4	Verify contract-studio-api returns session source reference (uploaded_contract_id or template_id)	3.0 Contract Studio API V2	30 min	High — needed for Phase 2

4.2 Phase 2 — Build the Studio Intelligence Layer (Core Build)

#	Task	Workflow / File	Effort	Impact
5	Add studio mode detection to context builder — query leverage_calculations to determine current mode	clarence-context-builder	1 hr	Critical
6	Add source clause content fetch — query uploaded_contract_clauses or template_clauses based on session source reference	clarence-context-builder	2 hrs	Critical
7	Add position labels fetch for all session clauses — not just when clauseId provided	clarence-context-builder	1 hr	Critical
8	Compose mode-appropriate system prompts — Solo Prep, Waiting, Active, Near Agreement each get distinct framing	clarence-ai	2-3 hrs	Critical
9	Update Solo Prep welcome prompt — reference document name, explain provisional status, invite clause exploration	clarence-ai	1 hr	High
10	Update clause_explain prompt — include actual clause text, position labels, Playbook rules, mode-appropriate caveats	clarence-ai	1-2 hrs	Critical

4.3 Phase 3 — Activation & Transition (After Leverage Verified)

#	Task	Workflow / File	Effort	Impact
11	Verify end-to-end leverage calculation fires — both parties complete, calculate-leverage workflow runs, leverage_calculations table populated	calculate-leverage v3.0	2-3 hrs	Critical
12	Verify position generation — session_clause_positions updated with three positions per clause after leverage fires	position generation workflow	1-2 hrs	Critical
13	Build studio activation transition message — CLARENCE sends message when provider completes, announces mode change to Active Negotiation	clarence-ai + contract-studio.tsx	1-2 hrs	High
14	Test Active Negotiation context quality — ask CLARENCE about a specific clause, verify it references actual document terms not invented ones	End-to-end test	1 hr	Critical — proof the build works

5. System Prompt Specifications
5.1 Solo Prep Mode — System Prompt
This prompt replaces the standard CLARENCE system prompt when studioMode === 'solo_prep'

You are CLARENCE, an AI-powered contract negotiation advisor operating as The Honest Broker.
 
CURRENT MODE: Solo Preparation
The provider ({providerCompany}) has not yet completed their strategic assessment.
 
WHAT YOU KNOW:
- The initiator's uploaded document: {contractName}
- The initiator's strategic assessment and priorities
- Company Playbook rules (where applicable)
- The actual clause wording from the source document
 
WHAT YOU DO NOT YET KNOW:
- The provider's strategic position or priorities
- Leverage calculations (require both parties' data)
- The provider's initial positions on any clause
 
BEHAVIOUR RULES:
1. Always reference actual clause text from the source document — never invent terms
2. Apply Playbook rules when relevant and cite them explicitly
3. Label all advice as provisional: 'Based on your document and current information...'
4. Never fabricate leverage scores or provider positions
5. Encourage the initiator to prepare their thinking — this time is valuable
6. When asked about a clause, lead with what the document actually says

5.2 Active Negotiation Mode — System Prompt
This prompt is used when studioMode === 'active_negotiation'

You are CLARENCE, an AI-powered contract negotiation mediator operating as The Honest Broker.
 
CURRENT MODE: Active Negotiation
Both parties have completed their assessments. Leverage has been calculated.
 
LEVERAGE BALANCE: Customer {customerLeverage}% | Provider {providerLeverage}%
FACTOR BREAKDOWN: Market Dynamics {md}% | Economic Factors {ef}% | Strategic Position {sp}% | BATNA {batna}%
 
SOURCE DOCUMENT: {contractName}
The initiator selected this document as their preferred starting terms.
When referencing clause terms, always use the actual language from this document.
 
CLAUSE CONTENT RULES:
- Position labels tell you what each number means in real contract terms
- Always cite the source document wording when explaining a clause
- Never invent payment periods, liability caps, or other specific terms
- If the document says '30 days' and leverage suggests position 4, explain the gap explicitly
 
PLAYBOOK: Apply company Playbook rules where relevant. Flag Red Lines immediately.
 
MEDIATOR RULES:
- You serve both parties equally — you are not the initiator's advocate
- Explain the leverage rationale behind every position recommendation
- Acknowledge when parties are close to agreement on a clause

6. The Correct Data Flow for Contract Create
This section documents the intended data flow from session creation through to active negotiation. Use this as a verification checklist during the implementation session.

6.1 Create Phase
•	create-contract wizard completes → session-create workflow fires
•	session record created in sessions table with: pathway_id, contract_type, deal context, uploaded_contract_id OR template_id
•	If uploaded: parse-contract-document fires → clauses extracted into uploaded_contract_clauses with clause_text populated
•	If template: template_clauses copied into session_clause_positions with template default positions
•	Routing: create-contract → strategic-assessment (with session_id + contract_id)

6.2 Assessment Phase
•	strategic-assessment page loads → CLARENCE chat active (clarence-chat workflow, not clarence-ai)
•	Customer completes 7 strategic questions → customer-requirements-api saves to customer_requirements
•	Routing: strategic-assessment → invite-providers (NOT contract-prep — that page is deprecated)
•	Provider invite sent via N8N workflow → email with token link
•	Provider completes: /provider/welcome → /provider/intake → /provider/questionnaire → /provider/providerConfirmation
•	Provider data saved to: provider_capabilities (intake) and provider_bids (questionnaire/strategic)

6.3 Leverage Trigger
•	Trigger condition: both customer_requirements AND provider_bids have records for this session
•	calculate-leverage workflow (v3.0) fires — four-factor model: Market Dynamics, Economic Factors, Strategic Position, BATNA
•	Output written to leverage_calculations table
•	Position generation fires: three positions per clause (CLARENCE recommendation, customer, provider) written to session_clause_positions
•	session.status updated to trigger Supabase Realtime notification to Contract Studio frontend

6.4 Studio Intelligence Context Fetch
Every CLARENCE call in the Contract Studio must go through this sequence:
•	Determine studio mode: query leverage_calculations for this session → if exists = Active Negotiation; else check provider journey status → Waiting or Solo Prep
•	Fetch source clause content: if uploaded_contract_id exists → query uploaded_contract_clauses; if template_id exists → query template_clauses
•	Fetch position labels: query clause_range_mappings for all clauses in this session
•	Fetch leverage (if Active): query leverage_calculations
•	Fetch positions (if Active): query session_clause_positions
•	Fetch Playbook: query playbook_rules for viewer's company
•	Compose mode-appropriate system prompt
•	Call Claude API with assembled context

7. Known Issues Register

#	Issue	Description	Severity	Phase to Fix
1	clause-chat-api-get empty body	Returns empty body not [] when no messages. Breaks JSON parse. Disrupts chat init.	Critical	Phase 1
2	strategic-assessment 500 error	Webhook returns 500. Assessment data not saved. Leverage can never fire.	Critical	Phase 1
3	No welcome message on studio load	CLARENCE is silent when user enters the studio. No greeting, no context.	Critical	Phase 1
4	Source clause text not in context	clarence-context-builder never fetches clause_text. CLARENCE invents contract terms.	Critical	Phase 2
5	Position labels missing from most prompts	Labels only fetched when clauseId provided. CLARENCE sees 'position 7' with no meaning.	Critical	Phase 2
6	Studio mode not detected	Context builder does not determine Solo Prep vs Active mode. Same prompt used regardless.	Critical	Phase 2
7	Leverage calculation end-to-end unverified	calculate-leverage v3.0 built Nov 2025. Full end-to-end with real data not confirmed.	High	Phase 3
8	Provider confirmation dead end	providerConfirmation page has no route to Contract Studio. Provider journey incomplete.	Critical	Separate handover — Provider Journey
9	Dual alignment confusion	Context returns two values both called 'alignment'. Claude picks wrong one.	High	Phase 2
10	Viewer anchoring weak	In long conversations Claude loses track of which party it is speaking to.	Critical	Phase 2

8. Reference Documents

Document	Relevance
HANDOVER-Contract-Create-Pathway.docx	End-to-end pathway audit. Stage-by-stage status, known issues register, implementation phases. Read before starting.
CLARENCE-AI-Context-Audit-Strategy.md	Root cause analysis of CLARENCE accuracy issues. Position label gaps, dual alignment confusion, viewer anchoring, prompt duplication.
HANDOVER-Contract-Studio-Consolidation.docx	Studio architectural plan. Solo Prep / Waiting / Activation states, hybrid detection model, contract-prep absorption.
FOCUS-23-Unified-Context-System.md	Unified context object schema. The target architecture for the context builder. SQL queries and data flow specification.
FOCUS-02-Core-Negotiation-Engine.md	Leverage algorithm specification. Four-factor model, position generation logic. Essential for understanding what the context builder must fetch.
CLARENCE_Negotiation_Algorithm.pdf	DLA Piper-verified position scoring framework. Defines what positions 1-10 mean per clause type. Source for position labels.
3.1 Clarence Chat (Refactored).json	The current clarence-chat workflow. Reference for how the prompt builder is structured and how context is assembled today.
THE-CLARENCE-BIBLE-V1_2.docx	Platform-wide architectural decisions. Contract-prep elimination, pathway simplification, studio consolidation. The source of truth on what the pathway should look like.

9. First Steps for the Implementation Session

Follow this sequence strictly. Do not skip ahead to Phase 2 until Phase 1 is verified clean.

•	Step 1 — Fix clause-chat-api-get. Apply the two-node fix described in Section 3.1. Deploy. Verify the frontend no longer throws SyntaxError on studio load.
•	Step 2 — Diagnose strategic-assessment 500. Open the N8N execution log for the strategic-assessment workflow. Identify the failing node. Check the customer_requirements table schema. Fix and verify assessment data saves correctly.
•	Step 3 — Add welcome trigger to contract-studio.tsx. On component mount, call clarence-ai with promptType: 'welcome' and the current session_id. Verify a message appears in the CLARENCE panel.
•	Step 4 — Verify contract-studio-api returns source reference. Check the API response includes uploaded_contract_id or template_id. If not, add it to the query.
•	Step 5 — Add studio mode detection to context builder. Query leverage_calculations for the session. If a record exists, mode = active_negotiation. If not, check provider journey status for solo_prep vs waiting.
•	Step 6 — Add source clause content fetch. Using the source reference from Step 4, fetch clause_text from uploaded_contract_clauses or template_clauses. Add as clauseContent section in context object.
•	Step 7 — Add position labels to context. Fetch clause_range_mappings for all clauses in the session. Add position label data to context for every clause, not just the active one.
•	Step 8 — Implement mode-appropriate system prompts. Use the specifications from Section 5. Solo Prep and Active Negotiation get distinct system prompts. Deploy and test both modes.
•	Step 9 — Quality test. In Solo Prep: ask CLARENCE about a specific clause. Verify it quotes the document wording and applies Playbook rules. Verify it labels advice as provisional. In Active Negotiation: ask about the same clause. Verify it references leverage scores and actual document terms.

Success criteria: CLARENCE greets the user on studio entry, correctly identifies the current mode, references actual clause wording in every response, applies Playbook rules, and never invents contract terms.


CLARENCE  |  Clarence Legal Limited  |  Confidential
