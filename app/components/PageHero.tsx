// ============================================================================
// PAGE HERO COMPONENT
// Location: app/components/PageHero.tsx
//
// Configurable hero section for public pages.
// Variants: light (white bg), dark (slate gradient), gradient (custom colors)
// ============================================================================

interface PageHeroBadge {
  icon?: string
  text: string
}

interface PageHeroProps {
  badge?: PageHeroBadge
  title: string | React.ReactNode
  subtitle: string
  variant?: 'light' | 'dark' | 'gradient'
  gradientFrom?: string
  gradientVia?: string
  gradientTo?: string
  children?: React.ReactNode
}

export default function PageHero({
  badge,
  title,
  subtitle,
  variant = 'dark',
  gradientFrom,
  gradientVia,
  gradientTo,
  children,
}: PageHeroProps) {
  const bgStyles = {
    light: 'bg-white border-b border-slate-200',
    dark: 'bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white',
    gradient: `bg-gradient-to-br ${gradientFrom || 'from-emerald-600'} ${gradientVia || 'via-emerald-500'} ${gradientTo || 'to-teal-500'} text-white`,
  }

  const textStyles = {
    light: { title: 'text-slate-800', subtitle: 'text-slate-600' },
    dark: { title: 'text-white', subtitle: 'text-slate-300' },
    gradient: { title: 'text-white', subtitle: 'text-white/80' },
  }

  const badgeBgStyles = {
    light: 'bg-slate-100 text-slate-700',
    dark: 'bg-slate-700/50 backdrop-blur border border-slate-600/50 text-slate-300',
    gradient: 'bg-white/20 backdrop-blur text-white',
  }

  return (
    <section className={`py-20 ${bgStyles[variant]}`}>
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          {badge && (
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8 ${badgeBgStyles[variant]}`}
            >
              {badge.icon && (
                <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">C</span>
                </div>
              )}
              <span>{badge.text}</span>
            </div>
          )}

          <h1
            className={`text-4xl md:text-5xl font-bold mb-6 ${textStyles[variant].title}`}
          >
            {title}
          </h1>
          <p
            className={`text-xl max-w-2xl mx-auto leading-relaxed ${textStyles[variant].subtitle}`}
          >
            {subtitle}
          </p>

          {children && <div className="mt-10">{children}</div>}
        </div>
      </div>
    </section>
  )
}
