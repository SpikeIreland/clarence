







CLARENCE
The Honest Broker

HANDOVER DOCUMENT
FA-10: Unified Context System
Three-Tier Intelligence, Viewer Anchoring & Prompt Consolidation



CLARENCE’s credibility with legal professionals depends entirely on the quality of its AI responses. Lawyers will check every term, every number, and every recommendation. This handover addresses the systemic issues causing party confusion, incorrect term references, inconsistent drafting, and under-utilised legal intelligence. It consolidates work from three previous chat sessions into a single implementation plan covering the three-tier intelligence architecture, viewer anchoring fixes, and prompt builder consolidation.


23 February 2026 • Version 1.0
Clarence Legal Limited • Confidential
Bible Reference: Chapter 5 (CLARENCE Personality), Chapter 8 (Workflows), Chapter 9 (Algorithm) • FA-10 / FOCUS-23
 
1. Why This Is the Highest-Priority Focus Area

CLARENCE’s entire value proposition rests on being a credible, knowledgeable mediator. Legal professionals are trained to scrutinise every detail. When CLARENCE confuses which party it is speaking to, references incorrect contract terms, or produces different drafting language each time, users lose confidence immediately and permanently.
The platform is not yet commercially deployed, which provides a window to fix these issues before they become reputation-damaging. However, beta testers have already reported multiple context-quality problems, and these will only become more visible as usage increases.

1.1 User-Reported Issues

#	Feedback	Root Cause	Severity
1	CLARENCE addresses the user as if they are the other party. Tells them to ‘move past the middle’ when they’re already past it.	Weak viewer anchoring in system prompt. Claude loses track of which party it’s advising.	Critical
2	CLARENCE redrafts the same clause in a different way each time a template is uploaded.	No temperature=0, no anchoring to range definitions. Drafting calls Claude with insufficient constraints.	Critical
3	Each upload provides different scores to clauses.	Certification calls Claude without deterministic settings. No position scale anchoring.	Critical
4	CLARENCE suggests ‘45-day payment terms” when the clause is for 30 days.	Position labels (position_1_label, position_5_label, position_10_label) not passed to Claude for most prompt types.	Critical
5	Wrong alignment percentage cited in chat.	Two different alignment calculations exist in the context (leverage alignment vs clause alignment), both labelled ‘alignment’.	Critical
6	CLARENCE understanding leverage in reverse.	Viewer role not strongly anchored. ‘Your leverage’ vs ‘their leverage’ ambiguous in the prompt.	Critical

Every one of these issues traces to the same architectural problem: CLARENCE’s context system was built incrementally, with different workflows assembling different subsets of data in different ways. The fix is not to patch individual symptoms — it is to consolidate the context and prompt systems so there is a single source of truth for what CLARENCE knows and how it communicates.
 
2. The Three-Tier Intelligence Architecture

This architecture was designed in the ‘Focus 23 Context System Continued’ chat session (13 February 2026). Tier 2 was partially implemented in the ‘Building a role-driven system’ chat (16 February 2026). Tier 3 remains future work.

Tier	Name	Source	Example	Status
1	Contract-Specific	Context builder (database queries)	‘Your position on liability cap is 7/10, which means capped at 150% of annual fees.’	Partial
2	Legal Domain Knowledge	Claude’s training data, activated via enhanced system prompts	‘Standard BPO liability caps range from 100–200% of annual fees across most UK outsourcing contracts.’	Partial
3	Jurisdictional / Current	Web search, legal databases, jurisdiction fields	‘Under UAE law, consequential damages exclusions are treated differently than under English law.’	Planned

2.1 Tier 1: Contract-Specific (Fix and Complete)
This is the data that comes from the database via the context builder workflows. It is partially working but has critical gaps documented in the AI Context Audit (5 February 2026).

What’s Working
Session/contract info, party names, leverage calculations (baseline and tracker), clause statistics (total, agreed, disputed), biggest gaps, recent position moves, recent CLARENCE chat messages, strategic assessment data, provider intake data, and playbook rules.

What’s Broken or Missing

Gap	Impact	Status
Position labels (position_1/5/10_label) not passed for most prompts	Claude invents contract terms. ‘45-day payment’ instead of ‘30 days’.	Critical
Two alignment values both called ‘alignment’	Claude cites wrong percentage. User sees clause alignment on screen but Claude may cite leverage alignment.	Critical
Party-to-party chat not included (party_messages, qc_party_messages)	CLARENCE has no awareness of direct discussions between parties. Gives advice that contradicts what parties already agreed in chat.	Missing
Viewer anchoring too weak	Claude loses track of which party it’s advising, especially in longer conversations.	Critical
Contract role context (protected/providing) not passed	Claude can’t say ‘as the Customer, position 7 favours you’. Partially fixed by role matrix work.	Partial
QC Studio context builder integration incomplete	clarence-qc-context-builder was built and deployed but the full chain (frontend → API route → context builder → prompt builder → Claude) may not be end-to-end connected.	In Progress

2.2 Tier 2: Legal Domain Knowledge (Activate)
Claude already has deep legal knowledge from its training data. The ‘Building a role-driven system’ chat partially activated this by adding a ‘YOUR LEGAL EXPERTISE’ section to the system prompts for both clarence-ai and clarence-chat. This section lists specific domain areas: commercial contract law, BPO, GDPR, TUPE, IP, liability, dispute resolution.
What remains incomplete: the ‘general_legal_query’ touchpoint type (routing non-contract questions to a prompt that encourages Claude to draw on its full legal training rather than constraining responses to the negotiation context); industry benchmarks (what’s ‘market standard’ for BPO in UK vs US); and clause business context being hardcoded for only 12 clause types instead of database-driven.

2.3 Tier 3: Jurisdictional Intelligence (Future)
Not yet implemented. Requires: governing_law and jurisdiction fields added to session setup; web search integration for current legal questions; jurisdiction-specific contract law reference data. This is a medium-term enhancement that should wait until Tiers 1 and 2 are solid.
 
3. Current Workflow Architecture

3.1 The Workflow Inventory

Workflow	Endpoint	Used By	Status
clarence-context-builder	/webhook/clarence-context-builder	Sub-workflow (called by others). Contract Studio only.	Deployed
clarence-qc-context-builder	/webhook/clarence-qc-context-builder	Sub-workflow. QC Studio only.	Deployed
clarence-ai	/webhook/clarence-ai	Contract Studio: welcome, clause_explain, chat, position_change, alignment_reached, recommendation_adopted.	Deployed
clarence-chat	/webhook/clarence-chat	Chat page, Assessment page, Dashboard.	Deployed
clarence-qc-chat	/webhook/clarence-qc-chat	QC Studio CLARENCE chat.	Deployed

3.2 The Core Problem: Prompt Duplication
clarence-ai and clarence-chat each build their own prompts from the same context object. This means bug fixes must be applied in two places, system prompt differences cause inconsistent personality, and one workflow may get updated while the other doesn’t. The same applies to clarence-qc-chat, which has its own prompt builder.
The AI Context Audit (5 February 2026) recommended a new architecture: a shared clarence-prompt-builder sub-workflow that all Claude-calling workflows use. This ensures a single source of truth for CLARENCE’s identity, language rules, position accuracy constraints, and viewer anchoring — regardless of which page or touchpoint triggered the call.

3.3 Recommended Architecture

Layer 1: Context Builders (data gathering — per environment)
clarence-context-builder (Contract Studio, keyed by sessionId) and clarence-qc-context-builder (QC Studio, keyed by contractId). These fetch data from the database and return a unified context object. They do not build prompts.

Layer 2: Prompt Builder (single source of truth — NEW)
clarence-prompt-builder: accepts a context object and a touchpoint type, returns a system prompt and user prompt. Contains all of CLARENCE’s identity, language rules, position accuracy rules, viewer anchoring, legal expertise framing, and role-aware language. Every Claude-calling workflow uses this.

Layer 3: Touchpoint Workflows (per-feature — response handling only)
clarence-ai, clarence-chat, clarence-qc-chat, and future workflows (drafting, training AI). These call the prompt builder, send to Claude, then handle the response (save chat messages, return to frontend, trigger events). They do not build prompts themselves.

This architecture means when you fix viewer anchoring, it’s fixed everywhere. When you add Tier 2 legal expertise, it’s available everywhere. When you update language rules, they apply everywhere. No more double-patching.
 
4. Fixing Viewer Anchoring (Party Confusion)

This is the most user-visible issue. When CLARENCE says ‘you should consider moving your position’, the user must know CLARENCE is talking to them, not the other party. Currently, Claude sometimes loses track in longer conversations because the viewer context is presented once at the start of the system prompt and then buried under data.

4.1 Current State
The system prompt says: ‘You are speaking to [Name] who is the [customer/provider].’ This is a single sentence in a long prompt. The role matrix work added contract role labels (Customer/Provider, Tenant/Landlord, etc.) and ‘YOU ARE SPEAKING TO’ blocks, but these may not be deployed in all workflows.

4.2 Required Fix
The viewer anchoring must be reinforced at three points in every prompt:

1. System prompt header: A mandatory block at the very start (before CLARENCE identity) that states: YOU ARE SPEAKING TO: [Name] ([Role Label]). ALWAYS use ‘you/your’ for [Name]. ALWAYS use ‘[Other Name]’ or ‘they/their’ for the other party. YOUR leverage is [X]%. THEIR leverage is [Y]%.
2. Data sections: Every data point that references a party must use ‘YOUR’ or ‘THEIR’ prefixes, not ‘customer’ or ‘provider’ which Claude may not correctly map to the viewer.
3. Task instructions: The user prompt must repeat the anchoring: ‘Remember: you are advising [Name] the [Role Label]. Do not confuse their interests with [Other Name]’s.’

4.3 Party Role Integration
The ‘Building a role-driven system’ chat implemented contract_type_roles and initiator_party_role. The context builders should now pass contractTypeKey and initiatorPartyRole, and the prompt builder should derive userRoleLabel and otherRoleLabel using the ROLE_LABELS constant (already written in role-matrix.ts). This was done for clarence-ai and clarence-chat prompts but needs verification that it’s deployed and working in all environments.
 
5. Implementation Status: What Was Built vs What Needs Finishing

Three previous chat sessions contributed to this focus area. This section tracks what was built, what was deployed, and what remains incomplete.

Component	Chat Session	Built?	Deployed?
AI Context Audit (root cause analysis)	Focus 23 (5 Feb)	Done	N/A (document)
Position labels added to biggest_gaps SQL	Focus 23 (5 Feb)	Done	Partial
Alignment terminology fix (leverageBalance vs clauseAlignment)	Focus 23 (5 Feb)	Done	Partial
Position accuracy rule in system prompts	Focus 23 (5 Feb)	Done	Partial
Viewer anchoring strengthened in prompts	Focus 23 (5 Feb)	Done	Partial
clarence-qc-context-builder workflow	Focus 23 (13 Feb)	Done	Deployed
QC context builder → chat integration	Focus 23 (13 Feb)	Done	Partial
Frontend sends viewerRole, viewerUserId, viewerCompanyId	Focus 23 (13 Feb)	Done	Partial
ROLE_LABELS constant + role derivation logic	Role-driven (16 Feb)	Done	Deployed
contract_type_roles table + get_role_context() function	Role-driven (16 Feb)	Done	Deployed
Tier 2 legal expertise in clarence-ai prompts	Role-driven (16 Feb)	Done	Partial
Tier 2 legal expertise in clarence-chat prompts	Role-driven (16 Feb)	Done	Partial
clarence-prompt-builder (single source of truth)	Recommended	Planned	Missing
Party-to-party chat in context builders	Identified	Missing	Missing
general_legal_query touchpoint type	Focus 23 (13 Feb)	Planned	Missing
Tier 3: jurisdiction fields + web search	Focus 23 (13 Feb)	Planned	Missing
Dashboard lightweight context builder	Focus 23 (13 Feb)	Planned	Missing

The pattern is clear: much of the work was designed and built in code, but deployment and end-to-end verification across all environments has not been confirmed. The first task for the implementation chat is a systematic verification of what is actually live in production.
 
6. Drafting Non-Determinism

The user feedback ‘CLARENCE redrafts the same clause in a different way each time’ overlaps with FA-13 (certification inconsistency) but is a distinct problem in the context system.

6.1 The Problem
When CLARENCE generates clause language (via the Draft tab in either studio), it calls Claude with the clause name, category, and agreed position but without: temperature=0 to constrain randomness; the clause_range_mappings definitions that anchor what the position means in real-world terms; the contract_type_roles context that determines which party’s interests the position favours; or any reference drafting templates.

6.2 The Fix
Drafting calls must go through the same prompt builder as all other touchpoints. The system prompt should include a ‘DRAFTING RULES’ section: ‘When generating clause language: (1) use the position label definitions to determine the exact terms to include; (2) use the contract type roles to determine which party benefits; (3) maintain consistency — if you have previously drafted this clause, produce the same language unless the position has changed; (4) use formal legal English appropriate for the jurisdiction.’
Additionally, temperature=0 should be set on all drafting Claude API calls. This is the same fix as FA-13’s certification anchoring — the problem is identical (Claude generating different output for the same input) and the fix is the same (constrain randomness + anchor to defined data).
 
7. Implementation Priority

#	Phase	Description	Effort	Impact
1	Verify	Systematically verify what is actually deployed in production. Check each item in Section 5. Test viewer anchoring by chatting as both initiator and respondent in the same contract.	2–3 hours	Critical
2	Quick fixes	Temperature=0 on ALL Claude API calls (clarence-ai, clarence-chat, clarence-qc-chat, certify-next-clause, drafting). This is a 15-minute change per workflow that reduces all non-determinism.	1 hour	High
3	Anchoring	Deploy the viewer anchoring fixes across all prompt builders. Verify party confusion is resolved by testing both perspectives.	2–3 hours	Critical
4	Consolidate	Build clarence-prompt-builder as a shared sub-workflow. Migrate clarence-ai, clarence-chat, and clarence-qc-chat to use it. This is the structural fix that prevents future drift.	4–6 hours	High
5	Party chat	Add party_messages (Contract Studio) and qc_party_messages (QC Studio) to their respective context builders. CLARENCE must know what parties have discussed.	2–3 hours	High
6	Tier 2	Complete Tier 2 activation: verify legal expertise prompts are deployed; add general_legal_query touchpoint type; replace hardcoded clause business context with database-driven descriptions.	3–4 hours	Medium
7	Tier 3	Add governing_law and jurisdiction fields to session/contract creation. Enhance system prompt to reference jurisdiction. Web search integration is a separate project.	Future	Planned

Phases 1–3 can be done in a single focused chat session. Phase 4 is ideally a dedicated session. Phases 5–6 can be incremental. Phase 7 is post-launch.
 
8. Reference Documents & Chat History

Document / Chat	Relevance
FOCUS-23-Unified-Context-System.md	The original FA-10 specification: TypeScript schema, SQL queries, implementation phases, context object definition. The design blueprint.
CLARENCE-AI-Context-Audit-Strategy.md	Root cause analysis (5 Feb 2026): identifies position label gaps, dual alignment confusion, viewer anchoring weakness, and prompt duplication. Lists exactly what each workflow passes to Claude and where the gaps are.
‘Focus 23 Context System Continued’ chat	The implementation chat (13 Feb 2026): built the QC context builder, designed the three-tier intelligence architecture, created the data accuracy fix handover, partially integrated QC chat.
‘Building a role-driven system’ chat	Role matrix implementation (16 Feb 2026): contract_type_roles table, ROLE_LABELS constant, enhanced prompts for clarence-ai and clarence-chat with Tier 2 legal expertise and role-aware language.
‘Focus 23 Context System’ chat	First audit (15 Jan 2026): workflow inventory, identified critical gaps in clarence-chat (relying on frontend-passed context instead of database queries), clarence-ai context compared.
role-matrix.ts (project knowledge)	The ROLE_LABELS constant and role derivation code. Shows the complete protected/providing party mapping for all 20 contract types.
CLARENCE_Negotiation_Algorithm (PDF)	The DLA Piper-verified position scoring framework. Defines what positions 1–10 mean for each clause type. The authoritative source for position labels.
FOCUS-FA13-Document-Upload-Parsing-V1.1.docx	FA-13 specification. The parse non-determinism issues overlap with context quality (certification scoring, drafting consistency).

8.1 First Steps for the Chat Session
1. Verify deployment: Test CLARENCE chat from both initiator and respondent perspectives in the same QC contract. Does CLARENCE correctly identify who it’s speaking to? Does it use the correct role labels?
2. Check the QC context builder chain: Is the frontend sending viewerRole/viewerUserId/viewerCompanyId? Is the API route calling the QC context builder? Is the prompt builder receiving the context object?
3. Export the current clarence-ai, clarence-chat, and clarence-qc-chat workflows as JSON. Compare the system prompts across all three for inconsistencies.
4. Set temperature=0 on all Claude API calls.
5. Verify position labels are being passed to all prompt types (not just clause_explain).
6. Fix alignment terminology if still presenting two values as ‘alignment’.
7. If viewer anchoring is still broken after these checks, implement the three-point anchoring from Section 4.2.
8. Begin the prompt builder consolidation once the above are stable.




CLARENCE · Clarence Legal Limited · Confidential
