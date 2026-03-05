







CLARENCE
The Honest Broker

INVESTMENT DATA ROOM
Project Brief & Specification



A custom-built, Clarence-branded investment data room deployed at dataroom.clarencelegal.ai. Built on the same engineering standards as the platform itself, it serves a dual purpose: secure document repository for the company and professional investor access portal. The data room is itself a demonstration of engineering capability.


19 February 2026 • Version 1.0
Clarence Legal Limited • Confidential
Company No. 16983899
 
1. The Vision

Most startups at pre-seed or seed stage put their investment materials in Google Drive, Dropbox, or a paid data room service like Dealroom or Ansarada. These are functional but generic. They say nothing about the company behind them.
CLARENCE is an engineering-led company. The platform is the product, and the quality of the engineering is the competitive advantage. An investor considering CLARENCE should experience that quality before they even see the product. The data room itself should be a quiet demonstration of capability: clean, fast, secure, professionally branded, and built in-house.
The data room has two audiences and two purposes:

For the company: A structured, versioned repository for all company documentation — the Bible, handovers, legal documents, financial models, IP register. The single source of truth for Clarence Legal Limited as a business entity.

For investors: A secure, access-controlled portal where due diligence materials are organised, professional, and trackable. Investors access only what they’re authorised to see, and the company knows exactly who viewed what and when.

The data room is not a marketing site. It is a professional, understated environment where serious people review serious documents. The tone should be: confident, thorough, and respectful of the reader’s time.
1.1 Why Not a Third-Party Service?
Third-party data rooms (Dealroom, Ansarada, DocSend) charge £200–£1,500/month and offer generic branding with someone else’s logo in the corner. More importantly, they demonstrate nothing about the company’s own capabilities. For an AI-powered engineering company to store its investment materials in someone else’s SaaS product is a missed opportunity.
Building the data room on the same stack (Next.js, Supabase, Vercel, N8N) demonstrates engineering self-sufficiency, reduces ongoing costs to near zero, provides complete control over branding and user experience, enables custom analytics and access tracking, and creates another piece of demonstrable IP.
1.2 The Dual-Purpose Architecture
The data room is not just investor-facing. It is also the company’s own document vault. Think of it as two layers:

Layer 1 — Internal: All company documents organised by category. Accessible by the Clarence team. Version-controlled. The canonical repository.
Layer 2 — Investor: A curated subset of Layer 1, plus investor-specific materials (pitch deck, financial model, term sheet). Accessible by authenticated investors with tracked activity.

Documents uploaded to the internal layer can be ‘published’ to the investor layer with a single toggle. This means the latest Bible, Features Register, or technical specification is always available to investors without manual copying.
 
2. Technical Architecture

2.1 The Stack
Layer	Technology	Notes
Frontend	Next.js 14+ / React / TypeScript / Tailwind	Separate Vercel project from the main platform. Deployed to dataroom.clarencelegal.ai.
Database	PostgreSQL via Supabase	Separate Supabase project. No shared data with production. Stores documents metadata, access logs, user accounts.
Authentication	Supabase Auth	Magic link (email) for investors. No passwords to remember. Email/password for admin team.
File Storage	Supabase Storage	PDFs, DOCX, XLSX stored with RLS policies. Documents served via signed URLs with expiry.
Workflow Engine	N8N (new project)	Handles email notifications, access logging, document processing. Separate from platform N8N.
Domain	dataroom.clarencelegal.ai	Subdomain of clarencelegal.ai. Vercel DNS handles routing. SSL automatic.
Deployment	GitHub → Vercel auto-deploy	Separate repository: clarence-dataroom. Same git-push.sh pattern.
Source Control	GitHub	New private repository: clarence-legal/clarence-dataroom.

2.2 Domain Configuration
The subdomain approach gives complete separation while maintaining brand unity. Configuration in Vercel:

clarencelegal.ai → Main Clarence platform (existing Vercel project)
dataroom.clarencelegal.ai → Investment Data Room (new Vercel project)

This requires a single DNS record addition (CNAME for dataroom subdomain pointing to Vercel). No changes to the existing platform. SSL is automatic via Vercel.
2.3 Separation Principle
The data room is entirely separate from the CLARENCE platform. Different codebase, different database, different Supabase project, different N8N workspace. This is deliberate:

Security: An investor accessing the data room can never accidentally (or intentionally) reach platform data.
Simplicity: The data room is a much simpler application. It doesn’t inherit the complexity of the negotiation engine.
Independence: Either project can be updated, redeployed, or taken offline without affecting the other.
Clean audit: Investor access logs exist in their own database, cleanly separated from product analytics.
2.4 Database Schema (Initial)
The data room needs a small, focused schema:

Table	Purpose
users	Admin team and investor accounts. Fields: id, email, name, role (admin/investor), company_name, created_at. Linked to Supabase Auth.
documents	Document metadata. Fields: id, title, description, category, file_path (Supabase Storage), version, visibility (internal/investor), uploaded_by, uploaded_at, file_size, file_type.
categories	Document categories. Fields: id, name, display_order, icon, description. E.g., 'Technical Architecture', 'Financial', 'Legal & Corporate'.
access_logs	Every document view tracked. Fields: id, user_id, document_id, action (viewed/downloaded), ip_address, user_agent, timestamp. The audit trail.
investor_access	Controls which investors can see which categories. Fields: id, user_id, category_id, granted_by, granted_at, expires_at. Enables tiered access.
sessions	Investor visit sessions. Fields: id, user_id, started_at, last_active_at, documents_viewed, total_time_seconds. Aggregate engagement tracking.
 
3. User Experience

3.1 Investor Journey
The investor experience should be effortless:

1. Invitation: Paul sends a branded email via N8N: “You’ve been invited to the Clarence Legal Data Room.” Contains a magic link.
2. Authentication: Investor clicks the magic link, lands on dataroom.clarencelegal.ai, and is authenticated. No password to create or remember.
3. Dashboard: Clean, minimal dashboard showing document categories they have access to. Each category shows document count and last updated date.
4. Browsing: Click a category to see documents. Each document shows title, description, version, file type, and size. Click to view inline (PDFs) or download.
5. Viewing: PDFs render inline in the browser. No download required to read. Download button available for offline access.

3.2 Admin Experience
The admin interface (accessible only to the Clarence team) provides:

Document Management: Upload, categorise, version, and publish documents. Toggle visibility between internal-only and investor-visible.
Investor Management: Add investors, grant/revoke category access, set access expiry dates, send invitations.
Analytics Dashboard: Who accessed what, when, for how long. Which documents are most viewed. Time spent per session. This intelligence is gold during fundraising — you know which investors are engaged before they call you.

3.3 Visual Design
The data room should feel like it belongs to CLARENCE without being the CLARENCE platform. Design principles:

Emerald accent: The same emerald (#059669) used across CLARENCE, but used sparingly. The data room is primarily dark/neutral with emerald as the accent colour.
Typography: Clean, professional. The same font system as the platform (Inter or system fonts with Tailwind).
Layout: Simple sidebar navigation with main content area. No complex multi-panel layouts. Documents are the focus.
Tone: Understated confidence. No animated backgrounds, no particle effects, no ‘startup energy’. Think: premium law firm document portal.
Clarence branding: ‘CLARENCE • The Honest Broker’ in the header. ‘Clarence Legal Limited’ in the footer. Company number visible. Professional, not playful.
 
4. Document Taxonomy
The data room organises documents into categories. Not every category is visible to every investor. The admin controls which categories each investor can access.

#	Category	Contents	Status	Tier
    INVESTMENT MATERIALS			
1	Executive Summary	One-page company overview, the problem, the solution, the opportunity	Needs Creating	All
2	Pitch Deck	Investor presentation (10–15 slides)	Needs Creating	All
3	Financial Model	Revenue projections, unit economics, runway analysis, use of funds	Needs Creating	All
4	Go-To-Market Strategy	CLARENCE-Go-To-Market-Strategy-v1_1.docx	Exists	All
    TECHNICAL DOCUMENTATION			
5	The Clarence Bible	Governing document. Architecture, pathways, algorithm, IP strategy.	Exists	Tier 2
6	Technical Architecture	Three Pathways Architecture, System Architecture Build handover	Exists	Tier 2
7	The Algorithm	Negotiation Algorithm Technical Specification, DLA Piper Score Weighting	Exists	Tier 2
8	Features Register	59 features across 9 categories with status tracking	Exists	Tier 2
9	Product Demo	Recorded demo video, Video Library Guide	Draft	All
    LEGAL & CORPORATE			
10	Certificate of Incorporation	Companies House certificate (Co. 16983899)	Needs Creating	Tier 2
11	Articles of Association	Company articles	Needs Creating	Tier 2
12	IP Register	From Bible Chapter 12. Formal IP asset register.	Draft	Tier 2
13	Shareholder Agreement	If applicable / once created	Not Started	Tier 3
    MARKET & TRACTION			
14	Market Analysis	Legal tech market size, competitive landscape, positioning analysis	Needs Creating	All
15	Client Interest	Lloyds response document, beta tester feedback, enterprise pipeline	Exists	Tier 2
16	Partnership Opportunities	DLA Piper methodology adoption, other strategic relationships	Draft	Tier 2
    TEAM & PEOPLE			
17	Founder Profiles	Paul’s background, John Hayward’s legal expertise	Needs Creating	All
18	Advisory Board	If applicable / planned advisors	Not Started	Tier 2

4.1 Access Tiers
Documents are organised into three access tiers. When an investor is invited, the admin selects which tier they receive:

All (Default): Investment materials, go-to-market strategy, product demo, market analysis, founder profiles. The essentials for initial interest.
Tier 2 (Due Diligence): Everything in All, plus: Bible, technical architecture, algorithm, features register, IP register, legal & corporate documents, client interest, partnership opportunities. For investors who are seriously evaluating.
Tier 3 (Full Access): Everything. Including shareholder agreement, cap table, detailed financials. For investors in advanced negotiations.

Tiers are not rigid. The admin can grant individual investors access to specific categories outside their tier if needed.
 
5. Access Control & Analytics

5.1 Authentication Model
Investors authenticate via magic link (passwordless email authentication). The flow:

1. Admin adds investor in the data room (email, name, company, tier).
2. N8N sends a branded invitation email with a Supabase magic link.
3. Investor clicks the link, is authenticated, and lands on their personalised dashboard.
4. Subsequent access: investor visits dataroom.clarencelegal.ai, enters their email, receives a new magic link. No password required.

Magic links are the right choice here: they’re secure, frictionless, and eliminate the ‘I forgot my password’ problem entirely. Investors are busy people. The fewer barriers, the more likely they are to actually review the materials.
5.2 Document Security
Documents are served via Supabase Storage signed URLs with configurable expiry (default: 1 hour). This means document URLs cannot be shared — they expire. Download tracking records every download event. Inline PDF viewing uses an embedded viewer that does not expose the raw file URL. Watermarking (Phase 2 enhancement) can stamp each PDF with the investor’s name and access timestamp.
5.3 Analytics Dashboard
The admin analytics dashboard provides fundraising intelligence. The data room tracks:

Per investor: Total visits, documents viewed, time spent per document, most recent access, download count.
Per document: Total views, unique viewers, average time spent, download count.
Aggregate: Total active investors, most popular documents, engagement trends over time.

This intelligence is extremely valuable during fundraising. If an investor has viewed the technical architecture three times and spent 45 minutes in the financial model, they’re seriously interested. If another investor was invited two weeks ago and hasn’t logged in, it’s time for a gentle follow-up.
The data room analytics turn investor due diligence from a black box into a visible process. You know who is engaged, what they care about, and when to follow up.
 
6. Content Assets: What Needs Creating
The data room is only as good as its contents. Some documents already exist in the CLARENCE project knowledge. Others need to be created from scratch. This section maps what exists, what needs adapting, and what needs writing.

6.1 Documents That Already Exist
Document	Current Location	Adaptation Needed
The Clarence Bible V1.2	Project Knowledge	None — upload directly
Go-To-Market Strategy V1.1	Project Knowledge	None — upload directly
Features Register V1.0	Project Knowledge	None — upload directly
Negotiation Algorithm Spec	Project Knowledge (PDF)	None — upload directly
DLA Piper Score Weighting	Project Knowledge (PDF)	None — upload directly
Three Pathways Architecture	Project Knowledge (PDF)	None — upload directly
Lloyds Response Document	Project Knowledge	Redact any confidential specifics
Video Library Guide	Project Knowledge	None — upload directly
N8N Workflow Registry	Project Knowledge	Review for internal-only content

6.2 Documents That Need Creating
These are the core investment materials that don’t yet exist. They should be created in the dedicated Claude project for the data room.

Document	Description	Priority	Format
Executive Summary	One-page company overview for investors. The problem, the solution, the market, the team, the ask.	Needs Creating	PDF
Pitch Deck	10–15 slide investor presentation. Problem, solution, market size, product, traction, team, financials, the ask.	Needs Creating	PPTX / PDF
Financial Model	Revenue projections (3–5 year), unit economics, customer acquisition costs, runway analysis, use of funds breakdown.	Needs Creating	XLSX / PDF
Market Analysis	Legal tech market sizing, competitive landscape, CLARENCE’s positioning, addressable market.	Needs Creating	PDF
Founder Profiles	Professional biographies. Why this team for this problem.	Needs Creating	PDF
IP Asset Register	Formal register based on Bible Chapter 12. Each IP asset catalogued with protection status.	Draft	PDF
Product Demo Recording	Narrated walkthrough of the QC pathway end-to-end. 5–10 minutes.	Not Started	Video / Link

The Claude project for the data room should focus on creating these investment materials. The technical documents already exist and just need uploading.
 
7. Implementation Plan

7.1 Phase 1: Infrastructure (Week 1)
Set up the foundations. No content yet — just the skeleton.

GitHub: Create clarence-dataroom repository.
Vercel: Create new project, connect to repo, configure dataroom.clarencelegal.ai subdomain.
Supabase: Create new project (clarence-dataroom). Create schema: users, documents, categories, access_logs, investor_access, sessions.
N8N: Create new workspace or folder. Build invitation email workflow.
Frontend: Next.js scaffold with Supabase auth, basic routing, Clarence branding.

7.2 Phase 2: Core Application (Week 2–3)
Build the application.

Admin: Document upload, categorisation, version management, visibility toggle.
Admin: Investor management (add, invite, set tier, revoke).
Investor: Dashboard, category browsing, document viewing, PDF inline viewer.
Auth: Magic link flow for investors, email/password for admin.
Logging: Access tracking on every document view and download.

7.3 Phase 3: Content Population (Week 3–4)
Upload existing documents and create new investment materials.

Upload: All existing documents from project knowledge.
Create: Executive summary, pitch deck, financial model, market analysis, founder profiles (via dedicated Claude project).
Review: Legal review of all investor-facing materials with John Hayward.

7.4 Phase 4: Analytics & Polish (Week 4–5)
The intelligence layer.

Analytics: Admin dashboard showing per-investor and per-document engagement metrics.
Polish: Mobile responsiveness, loading states, empty states, error handling.
Testing: Invite a test investor, walk through the complete journey, verify access controls.

7.5 Future Enhancements
Not in scope for initial build but worth noting for later:

Watermarking: Stamp PDFs with investor name + timestamp on download.
Q&A section: Investors can submit questions through the data room. Tracked and answered.
Version notifications: Automated email when a document the investor has viewed is updated.
NDA management: Digital NDA signing before Tier 2/3 access is granted.
Audit export: Export complete access log as evidence for compliance.
 
8. Claude Project: Setup Guide
The data room work will be managed through a dedicated Claude project, separate from the CLARENCE platform project. This section defines what that project should contain.

8.1 Project Name
Clarence Data Room

8.2 Project Instructions (Suggested)
You are assisting with the Clarence Legal Investment Data Room — a custom-built, Clarence-branded investor portal deployed at dataroom.clarencelegal.ai. The data room serves two purposes: secure company document repository and professional investor access portal. The tech stack is Next.js / TypeScript / Tailwind on Vercel, PostgreSQL via a dedicated Supabase project, and N8N for workflow automation. The codebase is in a separate GitHub repository (clarence-dataroom). The design should be understated and professional: emerald (#059669) accent on dark neutral backgrounds. Think premium law firm, not startup energy.

8.3 Project Knowledge to Upload
Upload these documents from the CLARENCE project to provide context:

This document (CLARENCE-Investment-Data-Room-Project-Brief.docx) — the complete specification.
THE-CLARENCE-BIBLE-V1_2.docx — for context on the company, product, and architecture.
CLARENCE-Go-To-Market-Strategy-v1_1.docx — for market positioning context.
CLARENCE-Features-Register-V1_0.docx — for product capability context.

Do NOT upload the full CLARENCE codebase or platform-specific handovers. The data room project does not need to know how the negotiation engine works internally — it just needs to present documents about it.
8.4 Workstreams
The Claude project will handle two parallel workstreams:

Workstream 1 — Application Build: The data room frontend, database schema, authentication, file management, analytics. This is engineering work.
Workstream 2 — Content Creation: The investment materials that don’t yet exist: executive summary, pitch deck, financial model, market analysis, founder profiles. This is creative/strategic work.

These can run in parallel. The application can be built with placeholder documents while the real content is being drafted.
 
9. The Meta Argument

There is an important strategic dimension to building the data room in-house rather than using a third-party service.
When an investor opens the data room, the first thing they experience is a piece of Clarence engineering. Before they read a single document, they’ve already seen evidence that this team can build clean, professional, functional web applications. The data room is doing double duty: it’s both the container and the proof.
This is particularly powerful for a pre-revenue or early-stage company where the product itself may not yet be publicly accessible. The investor might not be able to use CLARENCE directly, but they can use something built by the same team with the same tools and the same standards. If the data room is fast, well-designed, and secure, the investor has already formed a positive impression before evaluating the business case.
Conversely, if the data room were a generic Google Drive folder or a white-labelled Dropbox link, the implicit message is: this team either can’t build its own tools or didn’t think it was worth doing. For an engineering-led company, that’s a missed signal.
The data room is not just where investors find information about Clarence. It is itself a piece of information about Clarence.




CLARENCE · Clarence Legal Limited · Confidential
