import Link from 'next/link'

// ============================================================================
// SECTION CTA COMPONENT
// Location: app/components/SectionCTA.tsx
//
// Reusable dark call-to-action block used on most public pages.
// ============================================================================

interface CTALink {
  text: string
  href: string
}

interface SectionCTAProps {
  title: string
  subtitle: string
  primaryCTA: CTALink
  secondaryCTA?: CTALink
}

export default function SectionCTA({
  title,
  subtitle,
  primaryCTA,
  secondaryCTA,
}: SectionCTAProps) {
  return (
    <section className="py-20 bg-gradient-to-br from-slate-800 to-slate-900">
      <div className="container mx-auto px-6 text-center">
        {/* Brand echo */}
        <div className="text-2xl font-bold mb-6 flex items-baseline justify-center gap-2">
          <span className="text-emerald-400">Create</span>
          <span className="text-slate-600 font-light">·</span>
          <span className="text-slate-300">Negotiate</span>
          <span className="text-slate-600 font-light">·</span>
          <span className="text-violet-400">Agree</span>
        </div>

        <h2 className="text-3xl font-bold text-white mb-4">{title}</h2>
        <p className="text-slate-300 mb-8 max-w-xl mx-auto">{subtitle}</p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={primaryCTA.href}
            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
          >
            {primaryCTA.text}
          </Link>
          {secondaryCTA && (
            <Link
              href={secondaryCTA.href}
              className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg border border-slate-600 transition-all"
            >
              {secondaryCTA.text}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
