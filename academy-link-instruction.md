CLARENCE
The Honest Broker

Antigravity Instructions
Clarence Academy — Link Placement & Subdomain Integration
19 March 2026 · Clarence Legal Limited · Confidential
1. Context
The Clarence Academy is now live as a standalone subdomain:
academy.clarencelegal.ai
The Academy is a standalone, structured training programme that teaches the Clarence methodology of principled negotiation. It is open to anyone — platform subscribers and non-subscribers alike — with certification on completion.
Important: The Academy subdomain is its own front door. Visitors may arrive directly (via CPD listings, university partnerships, search, or direct links) without ever having visited clarencelegal.ai. The subdomain homepage must therefore be entirely self-contained — it explains the Academy, its value, and its structure without assuming prior context. No bridge page or explanatory page is needed on the main site.
The changes below are simply about adding signpost links from the main clarencelegal.ai site to the Academy subdomain.
2. Links to Add on clarencelegal.ai
All links below point to the same destination: https://academy.clarencelegal.ai
2.1 Footer Component
File: app/components/Footer.tsx
Add a “Clarence Academy” link in the footer. Place it in whichever column contains product or platform links (e.g. alongside “Training Studio”, “Playbooks”, or similar product links). If there is a “Resources” or “Learn” column, it fits there equally well.
	•	Link text: Clarence Academy
	•	URL: https://academy.clarencelegal.ai
	•	Opens in: Same tab (no target="_blank" — it’s part of the Clarence ecosystem)
2.2 Main Navigation
File: app/components/MainNavigation.tsx
This is optional at launch, but recommended. If the main navigation has a “Products” dropdown or similar, add “Academy” as an item. If it’s a flat nav bar, consider adding “Academy” as a top-level item — it is a flagship product, not a secondary feature.
	•	Link text: Academy
	•	URL: https://academy.clarencelegal.ai
	•	Positioning: Alongside or near “Training Studio” if that exists in the nav, or as a standalone top-level item
2.3 Hero / CTA Sections
File: app/page.tsx (landing page) and app/components/SectionCTA.tsx
The landing page already has two references that need updating:
Change 1: SectionCTA secondary button
At the bottom of the landing page, the SectionCTA component currently has:
	•	Current: secondaryCTA={{ text: 'Explore the Academy', href: '/products/training' }}
	•	Change to: secondaryCTA={{ text: 'Explore the Academy', href: 'https://academy.clarencelegal.ai' }}
Change 2: Professional Excellence Loop
The “Learn” step in the Professional Excellence Loop section references the Clarence Academy by name. No code change is strictly needed here (it’s descriptive text, not a link), but if there is ever a “Learn more” link added to this section, it should point to:
	•	https://academy.clarencelegal.ai
2.4 Products Page (if applicable)
File: app/products/page.tsx or app/lib/products.ts
If there is a products listing page that shows the Clarence Suite, the Academy should appear as a product card. The card’s CTA button should link externally to the subdomain rather than to an internal route.
	•	Card title: Clarence Academy
	•	Card description: A structured training programme in principled negotiation. Open to everyone. Certification on completion.
	•	CTA text: Visit the Academy
	•	CTA URL: https://academy.clarencelegal.ai
3. What Not to Build
To be clear about scope, the following are not needed on the main clarencelegal.ai site:
	•	No /academy route or page — there is no bridge page, explainer page, or landing page for the Academy on the main site. All Academy content lives on the subdomain.
	•	No /products/academy route — if there is currently a /products/training page that describes the Academy, it should either be removed or converted to a redirect to the subdomain.
	•	No embedded Academy content — course listings, module previews, and registration forms all live on the subdomain. The main site only links to it.
4. Link Behaviour Notes
	•	Same tab navigation: All Academy links from the main site should open in the same tab. The Academy is part of the Clarence ecosystem, not an external site. Use a standard <a> or Next.js <Link> without target="_blank".
	•	Full URL required: Because the Academy is on a subdomain (not a route), links must use the full URL (https://academy.clarencelegal.ai) rather than a relative path. Next.js <Link> works fine with absolute URLs.
	•	Consistent naming: Always refer to it as “Clarence Academy” or “the Academy” in link text and copy. Never “Academy course” or “training programme” — the Academy is the institution, not a course within it.
5. Summary of Changes
For quick reference, here are the changes in priority order:
	•	Footer: Add “Clarence Academy” link → https://academy.clarencelegal.ai
	•	SectionCTA: Update “Explore the Academy” href from /products/training → https://academy.clarencelegal.ai
	•	Products page: Add Academy product card linking to subdomain (if products listing exists)
	•	Main navigation: Add “Academy” nav item linking to subdomain (optional at launch)
	•	Remove/redirect: Any existing /products/training or /academy internal routes should redirect to the subdomain

CLARENCE · The Honest Broker
Clarence Legal Limited · Confidential
