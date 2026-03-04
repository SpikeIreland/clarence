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
    tagline: 'Standard contracts, fast',
    description:
      'Upload or select a template and let Clarence handle the rest. AI auto-configures clause ranges and positions so you can review, adjust, and send — without full mediation.',
    category: 'creation',
    icon: 'Zap',
    color: 'emerald',
    status: 'available',
    features: [
      'Template-based contract generation',
      'AI auto-configured clause positions',
      'Multi-recipient sending and tracking',
      'Status tracking from draft to signature',
      'Support for NDAs, service agreements, leases, and more',
      'Quick review and send workflow',
    ],
    useCases: [
      'Routine agreements and renewals',
      'NDAs and confidentiality agreements',
      'Standard service terms',
      'Employment and contractor agreements',
    ],
    journeyPhase: 'create',
  },
  {
    slug: 'contract-create',
    name: 'ContractCreate',
    fullName: 'Clarence ContractCreate',
    tagline: 'Your contract, professionally mediated',
    description:
      'Bring your own contract template, complete the strategic assessment, and invite the other party. Clarence provides full leverage analysis, three-position negotiation, and clause-by-clause mediation.',
    category: 'creation',
    icon: 'Scale',
    color: 'emerald',
    status: 'available',
    features: [
      'Upload your own contract templates',
      'Strategic assessment for both parties',
      'Party-fit and leverage scoring',
      'Three-position negotiation framework',
      'Clause-by-clause AI mediation',
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
    tagline: 'Built together, from the ground up',
    description:
      'No starting document from either side. Clarence generates the clause set based on the contract type, and both parties shape the agreement collaboratively from inception.',
    category: 'creation',
    icon: 'Users',
    color: 'violet',
    status: 'available',
    features: [
      'AI-generated clause sets by contract type',
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
    tagline: 'Balance documents to your target score',
    description:
      'Intelligent document analysis and preparation that balances contract terms to whatever fairness score you target. Ensure your documents meet your standards before negotiation begins.',
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
    tagline: 'High-quality legal intelligence',
    description:
      'An AI-powered legal knowledge assistant that provides expert-level contract intelligence. Like having a specialist law partner available on demand for guidance on clauses, terms, and best practices.',
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
    tagline: 'AI-mediated contract negotiation',
    description:
      'The heart of Clarence. Work through every clause with AI-powered mediation, real-time leverage tracking, and intelligent trade-off suggestions that guide both parties toward agreement.',
    category: 'negotiation',
    icon: 'MessageSquare',
    color: 'slate',
    status: 'available',
    features: [
      'Three-panel negotiation workspace',
      'Real-time leverage bar and position tracking',
      'AI-suggested trade-offs and compromises',
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
    tagline: 'Master negotiation risk-free',
    description:
      'Practice contract negotiation in a safe environment. Train your team on company playbooks, practice with AI opponents at adjustable difficulty, and prepare for important deals before going live.',
    category: 'negotiation',
    icon: 'GraduationCap',
    color: 'amber',
    status: 'available',
    features: [
      'AI opponents with adjustable difficulty',
      'Pre-built scenarios for common contract types',
      'Company playbook integration',
      'Team practice and multi-player sessions',
      'Progress tracking and skill development',
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
    tagline: 'Structured tender management',
    description:
      'Manage your tendering process with AI-powered evaluation and comparison. From issuing tenders to evaluating bids, Clarence brings structure and intelligence to procurement.',
    category: 'operations',
    icon: 'ClipboardList',
    color: 'teal',
    status: 'coming-soon',
    features: [
      'Tender creation and distribution',
      'Multi-provider bid management',
      'AI-powered bid evaluation',
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
    tagline: 'Digital signing ceremonies',
    description:
      'Complete the agreement with secure digital signing ceremonies. From final review to signature capture, Clarence Sign ensures a professional, auditable closing process.',
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
    tagline: 'Consumer contracts, simplified',
    description:
      'A streamlined variant for consumer-facing contracts. Straight to Contract removes complexity for B2C scenarios where speed and simplicity matter most.',
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
    tagline: 'Digital twinning and mediation architecture',
    description:
      'An advanced mediation platform architecture featuring Clarence digital twinning. Bringing AI-powered dispute resolution and intellectual property management to complex multi-party scenarios.',
    category: 'coming-soon',
    icon: 'Fingerprint',
    color: 'purple',
    status: 'coming-soon',
    features: [
      'Digital twin mediation architecture',
      'Multi-party dispute resolution',
      'IP rights management framework',
      'AI-powered mediation protocols',
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
