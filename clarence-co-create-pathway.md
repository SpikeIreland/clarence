







CLARENCE
The Honest Broker

HANDOVER DOCUMENT
Co-Create Pathway & Naming Transition



Co-Create is the fullest expression of the Honest Broker philosophy — both parties contributing to the creation of the agreement from inception. Rather than starting from an existing contract, CLARENCE generates clause language based on both parties’ inputs.


18 February 2026
Clarence Legal Limited  •  Confidential
Bible Reference: Chapter 4 (The Three Pathways)  •  Features Register: 2.11
 
1. Mission for This Chat

1.1 Primary Objective
Deliver the Co-Create pathway — a collaborative contract drafting experience where both parties and Clarence work together to build a contract from scratch, without an existing document as a starting point. This is the third and final pathway in CLARENCE’s three-pathway architecture.

1.2 Two Workstreams
This work divides into two distinct workstreams of very different scale.

Workstream 1 — Naming Transition (Small): Rename the three pathways on the create-contract page. ‘Straight to Contract’ becomes ‘Quick Create’, ‘Partial Mediation’ becomes ‘Contract Create’, and ‘Full Mediation’ becomes ‘Co-Create’. Update labels, database values, pathway ID prefixes, and Clarence chat messages. This is a contained change to the create-contract page and the session-create workflow.

Workstream 2 — Co-Create Studio (Large): Build the new collaborative environment where contract clauses are created between both parties and Clarence. This is the primary build. Once clauses are collaboratively drafted with initial positions, the session feeds into the existing Contract Studio for formal negotiation. The downstream infrastructure (Contract Studio, Document Centre, leverage calculation) does not need modification.

1.3 Why This Matters
Quick Create and Contract Create both assume a contract already exists — either as a template or an uploaded document. The user journey is about taking that existing document, parsing it, setting positions, and negotiating. Co-Create breaks that assumption entirely. There is no document to start from. The clauses themselves need to be invented collaboratively. This is a fundamentally different activity from position-setting or negotiation, and it needs its own space.
 
2. Current State of the Three Pathways

Pathway	Status	Current Journey
Quick Create (was Straight to Contract)	Working	create-contract → QC Studio. The most robust journey. Fully operational.
Contract Create (was Partial Mediation)	Working	create-contract → intake → strategic assessment → contract prep → invite providers → Contract Studio. Operational; contract-prep page has some pending visual work.
Co-Create (was Full Mediation)	Design TBD	Currently follows the same journey as Contract Create. No distinct collaborative drafting capability exists. The button labelled ‘Full Mediation’ routes through the same pathway matrix as Partial Mediation.

2.1 The Key Insight
Full Mediation and Partial Mediation currently follow the same journey through the create-contract page — the only difference is the pathway prefix (FM- vs PM-) and which stages are required/skipped. Both assume a document source. Co-Create needs to diverge after the initial setup steps, skipping the template/upload source selection entirely, and routing to a new collaborative environment instead.

2.2 Where the Pathways Converge
All three pathways ultimately produce the same output: a session with structured clauses, positions, and weights in session_clause_positions. This means all three feed into the same Contract Studio. The difference is how the clauses get created: Quick Create parses and auto-configures; Contract Create parses and lets the customer set positions; Co-Create will generate clauses collaboratively with both parties. The downstream infrastructure is pathway-agnostic.
 
3. Workstream 1: Naming Transition

This is a contained set of label, value, and routing changes. It should be done first as it establishes the correct naming before the Co-Create build begins.

3.1 Naming Map
Current Name	New Name	DB Value
Straight to Contract	Quick Create	quick_create (was straight_to_contract)
Partial Mediation	Contract Create	contract_create (was partial_mediation)
Full Mediation	Co-Create	co_create (was full_mediation)

3.2 Files to Modify
File	Changes Required
create-contract page	Mediation Type step: rename all three buttons and descriptions. Update MediationType type definition. Update CLARENCE_MESSAGES for the selection confirmations.
determinePathwayId()	Update mediationPrefix map: ‘quick_create’: ‘QC’, ‘contract_create’: ‘CC’, ‘co_create’: ‘CO’. This changes all pathway IDs (QC-EXISTING, CC-UPLOADED, CO-SCRATCH, etc.).
buildRedirectUrl()	Update prefix checks from STC/PM/FM to QC/CC/CO. Add CO- routing to Co-Create Studio (new page, Workstream 2).
PATHWAY_STAGE_CONFIG	Rename all FM- entries to CO-, all PM- entries to CC-, all STC- entries to QC-. Add new CO- pathway with template_source/selection/upload all skipped.
session-create N8N workflow	Ensure the workflow accepts the new mediation_type values and stores them in the sessions table.
sessions table (database)	Existing sessions use old values. Either migrate with UPDATE or support both old and new values during transition. Migration is cleaner.

3.3 Migration Consideration
Existing sessions in the database have mediation_type values like ‘straight_to_contract’, ‘partial_mediation’, ‘full_mediation’. A one-time SQL migration should update these: UPDATE sessions SET mediation_type = ‘quick_create’ WHERE mediation_type = ‘straight_to_contract’; and similarly for the other two. Run this before deploying the renamed frontend code.
 
4. Workstream 2: The Co-Create Studio

4.1 The Core Problem
Quick Create and Contract Create start from an existing document — a template or upload provides the clause structure, and the user journey is about configuring positions on those clauses. Co-Create has no starting document. The clauses themselves need to be created. This is a fundamentally different activity that needs its own environment.

4.2 What the Co-Create Studio Does
The Co-Create Studio is a collaborative, three-party environment (Customer, Provider, Clarence) where the contract is built from scratch. Clarence acts as facilitator, guiding both parties through the process of deciding what the contract should contain and what each clause should say. The output is a session with structured clauses, positions, and weights — the same data structure that Contract Studio expects.

4.3 Proposed User Journey

Step 1 — Contract Scope: Both parties describe what the agreement is about. Clarence asks questions: What service is being provided? What’s the expected duration? What are the key commercial terms? This is conversational, chat-driven.

Step 2 — Clause Generation: Based on the scope conversation and the contract type, Clarence proposes a set of clauses drawn from the master clause library (contract_clauses table). Clarence explains why each clause is recommended: ‘For a BPO agreement of this nature, you’ll typically need clauses covering Service Levels, Liability, Termination, Data Protection...’ Both parties can accept, reject, or request additional clauses.

Step 3 — Clause Discussion: For each clause, Clarence presents the range of possible positions (from the clause_range_mappings table) and facilitates a discussion between the parties about where they’d each like to start. This is not negotiation — it’s initial position-setting with both parties present, guided by Clarence’s knowledge of market norms.

Step 4 — Draft Review: Once all clauses have initial positions from both parties, Clarence presents a summary: ‘Here’s what we’ve built together. You have 14 clauses with an initial alignment of 68%. Some areas need negotiation.’ Both parties confirm they’re ready to proceed.

Step 5 — Transition to Contract Studio: The Co-Create Studio writes the structured clause data to session_clause_positions (the same table Contract Create populates via contract-prep) and redirects both parties to the Contract Studio for formal negotiation.

4.4 Key Design Decision: Early Provider Invite
Co-Create requires the provider to be present from the start — unlike Quick Create and Contract Create where the provider is invited after the customer has prepared. This means the invite step happens early in the journey, before the Co-Create Studio. The create-contract page for Co-Create should collect contract type and deal context, then immediately invite the provider. Both parties then enter the Co-Create Studio together.

4.5 Proposed Co-Create Journey
#	Stage	Page	Notes
1	Mediation Type	create-contract	User selects ‘Co-Create’.
2	Contract Type	create-contract	BPO, SaaS, NDA, etc.
3	Deal Context	create-contract	Quick intake: value, criticality, timeline.
4	Invite Provider	invite-provider (or inline)	Early invite — provider needed for collaboration.
5	Co-Create Studio	co-create-studio (NEW)	The primary build. Collaborative clause drafting.
6	Contract Studio	contract-studio (existing)	Formal negotiation. No changes needed.
7	Document Centre	document-centre (existing)	Evidence package. No changes needed.

4.6 What Co-Create Skips
The Co-Create journey skips: template source selection (there is no source document), template selection, document upload, strategic assessment (the scope conversation replaces this), and contract prep (positions are set collaboratively in the Co-Create Studio, not unilaterally in contract-prep).
 
5. Technical Architecture

5.1 New Page
Location: /app/auth/co-create-studio/page.tsx
Stage: Create (Emerald) — the Co-Create Studio is part of the Create stage, not Negotiate.

5.2 Interface Concept
The Co-Create Studio should be a three-panel layout, similar in spirit to the Contract Studio but focused on creation rather than negotiation. A possible structure: left panel for the clause list (building up as clauses are agreed), centre panel for the active discussion (chat-driven, with Clarence facilitating), and right panel for the clause detail view showing range mappings and position options when a specific clause is being discussed.

5.3 Data Flow
The Co-Create Studio reads from: contract_clauses (master clause library, to know what clauses are available for the selected contract type), clause_range_mappings (to show what each position means for each clause), and the session record (contract type, deal context, parties). It writes to: session_clause_positions (the same table that contract-prep populates, ensuring downstream compatibility with Contract Studio).

5.4 AI Integration
Clarence’s role in the Co-Create Studio is more active than in other parts of the platform. Clarence needs to: propose appropriate clauses based on contract type and deal context, explain each clause in plain language, present the range of positions with real-world descriptions, suggest starting positions based on the deal context and market norms, and facilitate discussion between the parties when they disagree on clause inclusion or initial positions. This will require a dedicated N8N workflow or direct Claude API calls with Co-Create-specific prompts.

5.5 Session Creation
When a user selects Co-Create on the create-contract page, the session-create workflow must handle the new co_create mediation type. The key difference: session_clause_positions should NOT be pre-populated from a template (since there is no template). Instead, the table starts empty and the Co-Create Studio progressively adds clauses as they are agreed by both parties.

5.6 Database Considerations
No new tables are required. The Co-Create Studio writes to existing tables (session_clause_positions, clause_events). The sessions table needs to accept mediation_type = ‘co_create’. The pathway_state JSONB column (if implemented per the journey matrix) should track Co-Create-specific stages.
 
6. Observability Requirements

CLARENCE is implementing system-wide observability using a standardised event logging pattern. The Co-Create pathway should be instrumented from the start, following the specification defined in FOCUS-09 and the Observability Handover document.

6.1 How Observability Works in CLARENCE
Every significant user action and system event is logged to the system_events table via a shared EventLogger utility (frontend) and a logging sub-workflow (N8N). Events follow a journey/step/status pattern: each event belongs to a journey_type, has a step_name, and records a status (started, completed, failed). Events carry a context JSONB payload for step-specific data.

6.2 Co-Create Journey Definition
The Co-Create pathway should define a new journey type: co_create_session. Key events to log:

Step Name	Status Values	Context Payload
co_create_selected	completed	contract_type, deal_value
provider_invited_early	started / completed / failed	provider_email
studio_loaded	completed	session_id, parties_present
scope_conversation_completed	completed	topics_discussed
clause_proposed	completed	clause_id, clause_name, proposed_by
clause_accepted	completed	clause_id, accepted_by_both
clause_rejected	completed	clause_id, rejected_by, reason
positions_set	completed	clause_id, customer_position, provider_position
draft_review_completed	completed	total_clauses, initial_alignment
transition_to_contract_studio	completed	session_id, clause_count

6.3 Implementation Pattern
On the frontend, use the shared EventLogger class: eventLogger.started(‘co_create_session’, ‘studio_loaded’, { session_id }). For N8N workflows (if the AI interaction goes through N8N), call the logging sub-workflow at each step. All logging is fire-and-forget with silent failure — observability must never break the user experience.

6.4 Where to Get the Full Specification
The complete observability specification is in FOCUS-09-System-Observability.md (project knowledge). The Observability Handover document (HANDOVER-System-Observability.docx) provides the implementation pattern and copy-paste code templates. The Observability chat owns the specification; this chat implements it for the Co-Create domain.
 
7. Implementation Phases

7.1 Phase 1: Naming Transition
Rename the three pathways across create-contract page, pathway configuration, CLARENCE messages, and the session-create workflow. Run database migration on existing sessions. Deploy and verify all three pathways still work correctly under their new names. This is a prerequisite for Phase 2.

7.2 Phase 2: Co-Create Studio — Scaffolding
Create the new page at /auth/co-create-studio. Build the three-panel layout. Implement the session loading and party detection (who is customer, who is provider). Wire up the routing so that selecting Co-Create on the create-contract page navigates through deal context and provider invite, then lands at the Co-Create Studio.

7.3 Phase 3: Co-Create Studio — Clause Generation
Build the scope conversation interface where Clarence asks about the agreement. Implement the AI-driven clause proposal system that draws from the master clause library. Allow both parties to accept, reject, or discuss proposed clauses. Display clauses in the left panel as they are agreed.

7.4 Phase 4: Co-Create Studio — Position Setting
For each agreed clause, present the range mappings and allow both parties to set initial positions. Clarence provides guidance based on deal context and market norms. Write agreed clauses and positions to session_clause_positions progressively.

7.5 Phase 5: Transition & Integration
Build the draft review screen summarising what’s been created. Implement the transition to Contract Studio. Verify the full end-to-end journey: Co-Create → Contract Studio → Document Centre works seamlessly. Add observability instrumentation throughout.
 
8. Key Files & References

File	Relevance
Create Contract page	Create_Contract_18022026.tsx and Create_Contracts_18022026.tsx in project knowledge. Contains mediation type selection, pathway logic, determinePathwayId(), buildRedirectUrl(), PATHWAY_STAGE_CONFIG.
Journey Matrix	create-phase-journey-matrix-v1_1.md in project knowledge. Complete pathway orchestration spec including stage configs, TypeScript types, and helper functions.
Bible Chapter 4	THE-CLARENCE-BIBLE-V1.1.docx — The Three Pathways. Defines Quick Create, Contract Create, Co-Create.
Features Register	CLARENCE-Features-Register-V1.0.docx — Item 2.11 (Co-Create pathway, status: Planned). Item 4.11 (Clarence generates contracts, status: Planned).
FOCUS-09 (Observability)	FOCUS-09-System-Observability.md — Event logging specification, EventLogger class, journey/step/status pattern.
Observability Handover	HANDOVER-System-Observability.docx — Implementation guide, code templates, and instrumentation map.
Three Studios Architecture	FOCUS-18-Three-Studios-Architecture-v1_1.md — Architectural separation of Contract Prep (solo), QC Studio (certification), and Contract Studio (negotiation). Co-Create Studio would be a fourth studio.
Contract Studio	FOCUS-19-Contract-Studio.md — The downstream destination. Understand what data it expects in session_clause_positions.
Negotiation Algorithm	CLARENCE_Negotiation_Algorithm__Technical_Specification.pdf — Position scale, range mappings, leverage calculation. Co-Create Studio needs to present these to users.

8.1 First Steps Checklist
1. Read the create-contract page code (both .tsx files in project knowledge) to understand the current pathway selection, routing, and CLARENCE message system.
2. Read create-phase-journey-matrix-v1_1.md for the full pathway orchestration spec and the PATHWAY_STAGE_CONFIG object.
3. Implement Workstream 1 (naming transition) first — it’s contained and establishes the correct foundation.
4. Read FOCUS-18 (Three Studios Architecture) and FOCUS-19 (Contract Studio) to understand what data the downstream expects.
5. Design the Co-Create Studio interface and discuss with Paul before building — this is a new UX pattern for CLARENCE.
6. Read FOCUS-09 and the Observability Handover to understand the event logging specification. Implement observability as you build, not as an afterthought.




CLARENCE · Clarence Legal Limited · Confidential
