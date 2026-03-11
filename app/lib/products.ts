// ============================================================================
// PRODUCT DATA REGISTRY
// Location: app/lib/products.ts
//
// Centralized product metadata consumed by:
// - MainNavigation (products dropdown)
// - Landing page (product showcase grid)
// - Products overview page (/products)
// - Footer (product links)
// - Pricing page (tier-product mapping)
// ============================================================================

export interface Product {
  slug: string
  name: string
  fullName: string
  tagline: string
  description: string
  category: 'creation' | 'document' | 'negotiation' | 'operations' | 'coming-soon'
  icon: string
  color: 'emerald' | 'slate' | 'violet' | 'amber' | 'blue' | 'teal' | 'purple'
  status: 'available' | 'coming-soon'
  features: string[]
  useCases: string[]
  journeyPhase: 'create' | 'negotiate' | 'agree' | 'support'
}

export const products: Product[] = [
  // ── CONTRACT CREATION ──────────────────────────────────────────────────
  {
    slug: 'quickcreate',
    name: 'QuickCreate',
    fullName: 'Clarence QuickCreate',
    tagline: 'Agreements at the speed of trust',
    description:
      'Upload any contract — simple or complex — set your terms, and send. Clarence configures fair starting positions so you can review, adjust, and move — without the back-and-forth.',
    category: 'creation',
    icon: 'Zap',
    color: 'emerald',
    status: 'available',
    features: [
      'Template-based contract generation for any contract type',
      'Intelligently configured clause positions',
      'Multi-recipient sending and tracking',
      'Status tracking from draft to signature',
      'Works with any contract — from NDAs to enterprise agreements',
      'Quick review and send workflow',
    ],
    useCases: [
      'High-volume contract programmes',
      'Enterprise agreements and renewals',
      'Procurement and vendor contracts',
      'Any contract where speed to agreement matters',
    ],
    journeyPhase: 'create',
  },
  {
    slug: 'contract-create',
    name: 'ContractCreate',
    fullName: 'Clarence ContractCreate',
    tagline: 'Your terms, honestly mediated',
    description:
      'Bring your own contract template, complete the strategic assessment, and invite the other party. Full leverage visibility, three-position negotiation, and clause-by-clause principled mediation — because both sides deserve to see the same picture.',
    category: 'creation',
    icon: 'Scale',
    color: 'emerald',
    status: 'available',
    features: [
      'Upload your own contract templates',
      'Strategic assessment for both parties',
      'Party-fit and leverage scoring',
      'Three-position negotiation framework',
      'Clause-by-clause principled mediation',
      'Full evidence package on completion',
    ],
    useCases: [
      'Procurement team negotiations',
      'Legal department contract workflows',
      'Enterprise contracts requiring structured negotiation',
      'High-value agreements with multiple stakeholders',
    ],
    journeyPhase: 'create',
  },
  {
    slug: 'co-create',
    name: 'Co-Create',
    fullName: 'Clarence Co-Create',
    tagline: 'No starting advantage. Just a starting point.',
    description:
      'No starting document from either side. Clarence generates the clause set based on the contract type, and both parties shape the agreement collaboratively from neutral ground.',
    category: 'creation',
    icon: 'Users',
    color: 'violet',
    status: 'available',
    features: [
      'Intelligently generated clause sets by contract type',
      'Collaborative drafting from neutral ground',
      'Both parties shape terms equally',
      'Built-in leverage balancing',
      'Full mediation support throughout',
      'Complete audit trail of collaborative decisions',
    ],
    useCases: [
      'New partnerships and joint ventures',
      'Equal-leverage deals',
      'Parties wanting neutral ground',
      'First-time business relationships',
    ],
    journeyPhase: 'create',
  },

  // ── DOCUMENT & KNOWLEDGE ───────────────────────────────────────────────
  {
    slug: 'document-preparation',
    name: 'Document Preparation',
    fullName: 'Clarence Document Preparation',
    tagline: 'Rebalance before you negotiate',
    description:
      'Intelligent document analysis that balances contract terms to your target fairness score. Ensure your documents meet your standards before the conversation begins.',
    category: 'document',
    icon: 'FileCheck',
    color: 'blue',
    status: 'coming-soon',
    features: [
      'Automated document analysis',
      'Fairness score targeting',
      'Clause-level balance assessment',
      'Recommendation engine for adjustments',
      'Multi-format document support',
      'Pre-negotiation document preparation',
    ],
    useCases: [
      'Legal teams preparing contract drafts',
      'Procurement reviewing vendor agreements',
      'Ensuring balanced starting positions',
      'Document quality assurance',
    ],
    journeyPhase: 'create',
  },
  {
    slug: 'contract-knowledge',
    name: 'ContractKnowledge',
    fullName: 'Clarence ContractKnowledge',
    tagline: 'Expert guidance on demand',
    description:
      'An expert-level knowledge assistant for contract guidance. Like having a specialist law partner available on demand for clauses, terms, and best practices.',
    category: 'document',
    icon: 'Brain',
    color: 'blue',
    status: 'coming-soon',
    features: [
      'Expert-level contract guidance',
      'Clause interpretation and explanation',
      'Industry-standard term references',
      'Best practice recommendations',
      'Risk assessment for contract terms',
      'Contextual legal knowledge on demand',
    ],
    useCases: [
      'Understanding complex contract terms',
      'Researching industry-standard clauses',
      'Training junior legal staff',
      'Quick legal reference during negotiations',
    ],
    journeyPhase: 'support',
  },

  // ── NEGOTIATION & TRAINING ─────────────────────────────────────────────
  {
    slug: 'negotiate',
    name: 'Negotiate',
    fullName: 'Clarence Negotiate',
    tagline: 'Where both sides come to terms',
    description:
      'The heart of Clarence. Work through every clause with principled mediation, real-time leverage visibility, and intelligent trade-off suggestions that guide both parties toward agreement — not advantage.',
    category: 'negotiation',
    icon: 'MessageSquare',
    color: 'slate',
    status: 'available',
    features: [
      'Three-panel negotiation workspace',
      'Real-time leverage bar and position tracking',
      'Intelligent trade-off suggestions and compromises',
      'Industry-standard position benchmarking',
      'Clause-by-clause mediation guidance',
      'Complete negotiation audit trail',
    ],
    useCases: [
      'Multi-party contract negotiations',
      'Complex clause-by-clause discussions',
      'Procurement and vendor negotiations',
      'High-stakes commercial agreements',
    ],
    journeyPhase: 'negotiate',
  },
  {
    slug: 'training',
    name: 'Training',
    fullName: 'Clarence Training Studio',
    tagline: 'Rehearse the deal before you do the deal',
    description:
      'A flight simulator for contract negotiation. Your team rehearses real scenarios against intelligent opponents, sharpens strategy on your own playbooks, and builds confidence — before the stakes are real.',
    category: 'negotiation',
    icon: 'GraduationCap',
    color: 'amber',
    status: 'available',
    features: [
      'Intelligent opponents with adjustable difficulty',
      'Pre-built mission scenarios for common contract types',
      'Company playbook integration',
      'Team war games and multi-player sessions',
      'Performance scorecard and skill development',
      'Promote training contracts to live templates',
    ],
    useCases: [
      'Onboarding new procurement staff',
      'Preparing for high-stakes negotiations',
      'Team skills development',
      'Testing strategies before going live',
    ],
    journeyPhase: 'negotiate',
  },

  // ── OPERATIONS ─────────────────────────────────────────────────────────
  {
    slug: 'tendering',
    name: 'Tendering',
    fullName: 'Clarence Tendering',
    tagline: 'Structured bids. Principled selection.',
    description:
      'Manage your tendering process with intelligent evaluation and comparison. From issuing tenders to evaluating bids, Clarence brings structure and principled selection to procurement.',
    category: 'operations',
    icon: 'ClipboardList',
    color: 'teal',
    status: 'coming-soon',
    features: [
      'Tender creation and distribution',
      'Multi-provider bid management',
      'Intelligent bid evaluation and scoring',
      'Comparative analysis dashboards',
      'Structured scoring and ranking',
      'Seamless transition to contract negotiation',
    ],
    useCases: [
      'Public sector procurement',
      'Enterprise vendor selection',
      'Multi-supplier competitive bidding',
      'Large-scale service tenders',
    ],
    journeyPhase: 'create',
  },
  {
    slug: 'sign',
    name: 'Sign',
    fullName: 'Clarence Sign',
    tagline: 'The moment of agreement',
    description:
      'Complete the agreement with secure digital signing ceremonies. From final review to signature capture — a professional, auditable moment that marks the beginning of a relationship.',
    category: 'operations',
    icon: 'PenTool',
    color: 'violet',
    status: 'coming-soon',
    features: [
      'Digital signing ceremonies',
      'Multi-party signature collection',
      'Audit trail and timestamp verification',
      'Final document review workflow',
      'Secure signature capture',
      'Integrated with the full Clarence workflow',
    ],
    useCases: [
      'Contract execution and finalisation',
      'Multi-stakeholder sign-off',
      'Regulatory-compliant document signing',
      'Remote contract ceremonies',
    ],
    journeyPhase: 'agree',
  },

  // ── COMING SOON ────────────────────────────────────────────────────────
  {
    slug: 'b2c',
    name: 'B2C',
    fullName: 'Clarence B2C',
    tagline: 'Fair terms for everyone',
    description:
      'A streamlined pathway for consumer-facing agreements. Straight to Contract removes complexity for B2C scenarios where speed, simplicity, and fairness matter most.',
    category: 'coming-soon',
    icon: 'ShoppingBag',
    color: 'purple',
    status: 'coming-soon',
    features: [
      'Streamlined consumer contract flow',
      'Simplified terms presentation',
      'Mobile-friendly contract experience',
      'Quick acceptance workflow',
      'Consumer protection compliance',
      'Integrated payment terms',
    ],
    useCases: [
      'Consumer service agreements',
      'Subscription contracts',
      'Freelancer-client agreements',
      'Simple commercial transactions',
    ],
    journeyPhase: 'create',
  },
  {
    slug: 'ip',
    name: 'IP',
    fullName: 'Clarence IP',
    tagline: 'Principled resolution at scale',
    description:
      'An advanced mediation architecture featuring Clarence digital twinning. Principled dispute resolution and intellectual property management for complex multi-party scenarios.',
    category: 'coming-soon',
    icon: 'Fingerprint',
    color: 'purple',
    status: 'coming-soon',
    features: [
      'Digital twin mediation architecture',
      'Multi-party dispute resolution',
      'IP rights management framework',
      'Principled mediation protocols',
      'Complex scenario modelling',
      'Cross-jurisdictional support',
    ],
    useCases: [
      'Intellectual property disputes',
      'Complex multi-party mediations',
      'Cross-border contract disputes',
      'Digital rights management',
    ],
    journeyPhase: 'negotiate',
  },
]

// ── CATEGORY DEFINITIONS ───────────────────────────────────────────────────

export const productCategories = [
  { key: 'creation' as const, label: 'Contract Creation' },
  { key: 'document' as const, label: 'Document & Knowledge' },
  { key: 'negotiation' as const, label: 'Negotiation & Training' },
  { key: 'operations' as const, label: 'Operations' },
  { key: 'coming-soon' as const, label: 'Coming Soon' },
]

// ── HELPER FUNCTIONS ───────────────────────────────────────────────────────

export function getProductsByCategory(category: Product['category']): Product[] {
  return products.filter((p) => p.category === category)
}

export function getAvailableProducts(): Product[] {
  return products.filter((p) => p.status === 'available')
}

export function getComingSoonProducts(): Product[] {
  return products.filter((p) => p.status === 'coming-soon')
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug)
}

export function getFeaturedProducts(): Product[] {
  // Products to highlight on landing page
  return products.filter((p) =>
    ['quickcreate', 'contract-create', 'co-create', 'negotiate', 'training', 'sign'].includes(p.slug)
  )
}
