


Clarence Platform
Admin/Monitor Page — Handoff Brief
For the Antigravity Codebase Agent
23 March 2026


This document describes the database layer, views, and data structures that have been built to power the admin/monitor page. The Antigravity agent should use this as the specification for building the frontend components.

Prepared by: Cowork Agent (Claude)
Supabase Project: wlrlkvqiakaiydfqqdmu (ap-southeast-1)
Status: Database layer complete. Frontend build required.

1. Overview and Purpose
The admin/monitor page serves three distinct audiences with increasing levels of sophistication:

	•	Paul (Operational): Triage escalation management, AI response quality tracking, system health monitoring via system_events observability data.
	•	Enterprise Prospects (Data Sovereignty): An animated data journey visualisation showing exactly where contract data flows geographically — from user input through processing to storage. Demonstrates compliance credibility.
	•	Investors (Data Room): The same visualisation with aggregate metrics overlaid — throughput, latency percentiles, zero-data-residency proof. Signals engineering maturity.

The page is separate from admin/beta-testing (which handles operational feedback visualisation for the wider team) and auth/company-admin (which is client-facing configuration). The monitor page is Paul’s personal command centre and the platform’s credibility showcase.
2. New Database Tables
Six new tables and five views have been deployed. All tables have RLS enabled, updated_at triggers, and appropriate indexes.
2.1 Feedback Triage Tables
feedback_classifications
AI-generated classification for each feedback item. One-to-one with beta_feedback.

Column
Type
Purpose
classification_id
UUID PK
Primary key
feedback_id
UUID FK → beta_feedback
The feedback item being classified
theme
VARCHAR(50)
position_accuracy, party_context, playbook_clause, ai_response, ui_display, performance, training, infrastructure, other
severity
VARCHAR(20)
critical, high, medium, low
confidence_score
NUMERIC(3,2)
0.00–1.00 — how confident the AI is in its classification
likely_resolved
BOOLEAN
Whether the issue was probably fixed in the recent DB restructure
resolution_reason
TEXT
Why the AI thinks it’s resolved
classification_reasoning
TEXT
AI’s explanation of its classification logic
suggested_action
VARCHAR(50)
auto_respond, escalate_paul, escalate_agent, monitor, close_resolved
classified_by
VARCHAR(50)
system or admin user_id
model_version
VARCHAR(50)
e.g. claude-sonnet-4-20250514

feedback_responses
Automated and manual responses sent back to users. Multiple responses per feedback item (e.g., acknowledgement then resolution).

Column
Type
Purpose
response_id
UUID PK
Primary key
feedback_id
UUID FK → beta_feedback
Which feedback item this responds to
response_text
TEXT
The message sent to the user
response_type
VARCHAR(30)
auto_acknowledgement, auto_guidance, auto_resolution, manual_response, escalation_notice
responded_by
VARCHAR(50)
system or admin user_id
is_visible_to_user
BOOLEAN
Gate for user-facing display
seen_by_user
BOOLEAN
Read receipt tracking
seen_at
TIMESTAMPTZ
When the user saw it

feedback_escalations
Tracks routing and resolution for items needing human or agent intervention.

Column
Type
Purpose
escalation_id
UUID PK
Primary key
feedback_id
UUID FK → beta_feedback
The feedback item escalated
classification_id
UUID FK → feedback_classifications
Link to the triage classification
escalated_to
VARCHAR(50)
paul, intermediary_agent, support_queue
escalation_reason
TEXT
Why this was escalated
escalation_status
VARCHAR(20)
open → acknowledged → investigating → resolved/deferred/closed
priority_override
VARCHAR(20)
Can bump severity beyond classification
resolution_notes
TEXT
What was done to resolve it
notification_sent
BOOLEAN
Whether Paul was notified
notification_channel
VARCHAR(30)
email, webhook, in_app

2.2 Data Journey Tables
service_topology
Reference table mapping each infrastructure service to its geo-location. This is the node data for the map visualisation.

Column
Type
Purpose
service_id
VARCHAR(50) PK
e.g. supabase_db, anthropic_api, vercel_edge
service_name
VARCHAR(100)
Display name for the UI
service_type
VARCHAR(30)
database, ai_provider, orchestration, edge_network, serverless, auth, storage
provider
VARCHAR(50)
AWS, GCP, Vercel, Anthropic, n8n
region_code
VARCHAR(30)
e.g. ap-southeast-1, us-east1
region_label
VARCHAR(100)
Human-readable: Singapore, N. Virginia, USA
latitude / longitude
NUMERIC(9,6)
Geo-coordinates for map pin placement
data_at_rest
BOOLEAN
Does this service store data persistently?
data_in_transit
BOOLEAN
Does data pass through this service?
data_retention_policy
TEXT
Plain-English description of data handling
encryption_in_transit / at_rest
BOOLEAN
Encryption flags
compliance_notes
TEXT
SOC 2, data residency, etc.
icon_name
VARCHAR(50)
For frontend icon rendering (database, brain, globe, etc.)

Pre-seeded with 7 services: Supabase PostgreSQL, Supabase Auth, Supabase Storage (all Singapore), Claude AI/Anthropic (US), n8n Cloud (US, pending confirmation), Vercel Edge (global), Vercel Serverless (Singapore).

data_journey_hops
Defines the expected sequence of service-to-service hops for each journey type. This is the edge/line data for the map animation.

Column
Type
Purpose
hop_id
SERIAL PK
Auto-incrementing ID
journey_type
VARCHAR(50)
Matches system_events.journey_type
hop_sequence
INT
Order of this hop in the journey (1, 2, 3...)
from_service_id / to_service_id
VARCHAR(50) FK
Which services this hop connects
hop_label
VARCHAR(100)
e.g. Contract text sent for analysis
data_description
TEXT
What data is moving
data_sensitivity
VARCHAR(20)
public, internal, confidential, restricted
typical_latency_ms
INT
Expected time for this hop
line_style
VARCHAR(20)
solid, dashed, animated
line_color
VARCHAR(20)
Hex colour for the line

Pre-seeded with 4 journey types: contract_analysis (10 hops), negotiation (8 hops), chat (6 hops), feedback_triage (6 hops).

2.3 Columns Added to Existing Tables
beta_feedback (3 new columns)

Column
Type
Purpose
classification_id
UUID FK → feedback_classifications
Links to the AI triage result
auto_triaged_at
TIMESTAMPTZ
When the triage agent processed this item
triage_status
VARCHAR(20)
Pipeline position: pending → classified → responded → escalated → resolved → closed

system_events (2 new columns)

Column
Type
Purpose
service_region
VARCHAR(30)
Region code of the service that generated this event
service_id
VARCHAR(50) FK → service_topology
For geo-location lookup in journey traces

3. Database Views (API Layer)
These views are the primary data source for the monitor page. Query them directly via Supabase client.

3.1 v_escalation_dashboard
The escalation queue. Joins feedback_escalations with beta_feedback, feedback_classifications, and the latest feedback_response. Pre-sorted: open items first, then by priority (critical → low), then by date.

Key columns: escalation_id, escalation_status, priority_override, feedback_title, feedback_description, theme, severity, confidence_score, classification_reasoning, user_response, seen_by_user.

Use case: Render as a sortable/filterable table on the monitor page. Paul can click into an escalation, see the full context, update status, and add resolution notes.

3.2 v_triage_summary
Single-row aggregate for KPI cards. Returns counts by triage_status (pending, classified, responded, escalated, resolved, closed), open/active escalation counts, theme-specific counts for the last 30 days (position_issues_30d, party_issues_30d, playbook_issues_30d, ai_issues_30d), and volume metrics (feedback_7d, feedback_30d, feedback_total).

Use case: Dashboard header cards showing key numbers at a glance.

3.3 v_triage_theme_trend
Weekly theme breakdown for the last 90 days. Returns week, theme, severity, count, avg_confidence, likely_resolved_count.

Use case: Stacked area or bar chart showing how feedback themes trend over time. Important for spotting whether position_accuracy issues are decreasing after fixes.

3.4 v_journey_trace
Reconstructs individual user journeys from system_events, joined with service_topology for geo-coordinates. Returns trace_id, session_id, journey_type, step_name, status, timestamps, duration_ms, plus latitude, longitude, region_label, country_code from the topology.

Use case: Replay a specific user’s journey on the map, or debug a failed step by seeing exactly where in the pipeline it broke.

3.5 v_data_journey_map
The complete data journey definition with geo-coordinates for both ends of every hop. Returns journey_type, hop_sequence, hop_label, data_description, data_sensitivity, typical_latency_ms, plus from/to coordinates, region labels, country codes, icon names, and whether data is stored at each endpoint.

Use case: THE primary data source for the animated world map visualisation. Select a journey type, iterate through hops in sequence, animate a dot moving between the geo-coordinates. The data_sensitivity and data_at_rest fields drive visual cues (colour-coding, storage icons at rest points).

4. Data Journey Visualisation Concept
This is the centrepiece of the monitor page and the feature that turns it into a sales and investor tool.

4.1 The Map
A world map (suggest react-simple-maps or Mapbox GL) showing service nodes pinned at their geo-coordinates. Singapore has 4 nodes clustered (Supabase DB, Auth, Storage + Vercel Serverless). US East has 2 nodes (Anthropic API + n8n Cloud). Vercel Edge is shown as a ring of dots around the globe representing its CDN PoPs.

Each node displays its icon_name, service_name, and a subtle glow when active. Nodes that store data (data_at_rest = true) have a distinct visual treatment — perhaps a solid fill or a lock icon — to emphasise where data lives.

4.2 The Animation
When a journey type is selected (e.g., Contract Analysis), an animated dot traces the path hop by hop. Each hop takes proportionally longer based on typical_latency_ms — the AI processing hop (3000ms) is visually slower than a local DB write (30ms). The total journey is slowed down to around 8–12 seconds for dramatic effect.

As the dot moves, a sidebar or overlay shows the current hop_label and data_description. For confidential data hops, the line could pulse red/amber. When the dot reaches a data_at_rest node, a brief “stored” animation plays.

The key narrative this tells: “Your contract text travels from your browser to Singapore, briefly visits the US for AI analysis (with zero retention), and returns to Singapore where it’s encrypted at rest. The entire journey takes under 4 seconds.”

4.3 User Location
Vercel automatically provides x-vercel-ip-country, x-vercel-ip-city, x-vercel-ip-latitude, and x-vercel-ip-longitude headers on every request. The frontend can use these to place a “You are here” pin on the map, making the first hop (user → Vercel Edge → Vercel Serverless) personalised. For the demo/investor view, this could default to London or the viewer’s actual location.

4.4 Journey Types Available

Journey
Hops
Key Story
Contract Analysis
10
Full document upload → AI extraction → clause-by-clause storage
Negotiation
8
Position update → leverage recalculation → AI assessment
Chat
6
User message → context assembly → AI response → streamed back
Feedback Triage
6
Feedback submission → AI classification → routing

More journey types can be added by inserting rows into data_journey_hops. No code changes needed.

5. Suggested Monitor Page Layout
The page should follow the same design language as auth/company-admin. Suggested structure:

5.1 Top Bar: KPI Cards
Source: v_triage_summary. Cards for: Pending Triage (pending_count), Open Escalations (open_escalations), Position Issues (30d) (position_issues_30d), Party Issues (30d) (party_issues_30d), Feedback This Week (feedback_7d).

5.2 Tab 1: Escalation Queue
Source: v_escalation_dashboard. A table with columns: Status (colour-coded chip), Priority, Title, Theme, Severity, Escalated, Seen. Clicking a row opens a detail panel where Paul can update escalation_status, add resolution_notes, and see the full classification_reasoning and user response.

5.3 Tab 2: Feedback Trends
Source: v_triage_theme_trend. A stacked area chart showing weekly volume by theme. Filter by severity. Below it, a breakdown table.

5.4 Tab 3: Data Journey
Source: v_data_journey_map + service_topology. The world map visualisation described in Section 4. Journey type selector at the top. Play/pause controls. Sidebar with hop detail.

5.5 Tab 4: System Health
Source: system_events (direct query or future view). Real-time event log, error rate charts, journey completion rates, average latency by journey type.

6. Security and Access

Table
User Access
Admin Access
Service Role
feedback_classifications
None
Full (is_platform_admin)
Full
feedback_responses
SELECT own (via beta_feedback.user_id + is_visible_to_user)
Full
Full
feedback_escalations
None
Full
Full
service_topology
No RLS (reference data)
Full
Full
data_journey_hops
No RLS (reference data)
Full
Full

The monitor page should only be accessible to platform admins. The Supabase client will automatically enforce RLS on all queries. The service_topology and data_journey_hops tables do not have RLS enabled as they contain no sensitive data — they are reference/config tables.
7. Triage Workflow (n8n)
Workflow file: 14_01_-_Feedback_Triage_Agent.json (in n8n Workflows/migrated/).

23 nodes, 7 parallel LOG nodes. Schedule trigger every 5 minutes, processes up to 20 pending items per run. Classifies via Claude Sonnet, routes through a 5-way switch (auto_respond, escalate_paul, escalate_agent, close_resolved, monitor), writes to all three triage tables, and updates beta_feedback.triage_status.

The workflow ships with active: false. Paul will enable it when ready to go live.

Dry-run completed successfully against 5 real feedback items on 23 March 2026. All classifications, responses, and escalations were written correctly.
8. What the Antigravity Agent Needs to Build

	•	The admin/monitor page route and navigation entry (admin-only)
	•	KPI card components querying v_triage_summary
	•	Escalation queue table component querying v_escalation_dashboard, with detail panel for status updates
	•	Feedback trend chart component querying v_triage_theme_trend
	•	World map visualisation component using v_data_journey_map and service_topology
	•	Journey type selector and animation controls (play, pause, speed)
	•	User geo-location pin using Vercel headers (x-vercel-ip-latitude, x-vercel-ip-longitude)
	•	System health tab with system_events log viewer
	•	Supabase real-time subscriptions on feedback_escalations for live updates when new escalations arrive

All data access is via standard Supabase client queries against the views listed above. No Edge Functions or custom APIs are needed.
