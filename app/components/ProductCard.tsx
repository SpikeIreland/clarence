import Link from 'next/link'
import {
  Zap,
  Scale,
  Users,
  FileCheck,
  Brain,
  MessageSquare,
  GraduationCap,
  ClipboardList,
  PenTool,
  ShoppingBag,
  Fingerprint,
  ArrowRight,
} from 'lucide-react'
import type { Product } from '@/app/lib/products'

// ============================================================================
// PRODUCT CARD COMPONENT
// Location: app/components/ProductCard.tsx
//
// Reusable card for product grids on the landing page and /products.
// "Coming Soon" products get muted styling with badge.
// ============================================================================

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  Scale,
  Users,
  FileCheck,
  Brain,
  MessageSquare,
  GraduationCap,
  ClipboardList,
  PenTool,
  ShoppingBag,
  Fingerprint,
}

const colorMap = {
  emerald: {
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    border: 'border-emerald-200',
    gradient: 'from-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
    link: 'text-emerald-600 hover:text-emerald-700',
  },
  slate: {
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-700',
    border: 'border-slate-200',
    gradient: 'from-slate-50',
    badge: 'bg-slate-100 text-slate-700',
    link: 'text-slate-700 hover:text-slate-900',
  },
  violet: {
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-600',
    border: 'border-violet-200',
    gradient: 'from-violet-50',
    badge: 'bg-violet-100 text-violet-700',
    link: 'text-violet-600 hover:text-violet-700',
  },
  amber: {
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    border: 'border-amber-200',
    gradient: 'from-amber-50',
    badge: 'bg-amber-100 text-amber-700',
    link: 'text-amber-600 hover:text-amber-700',
  },
  blue: {
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    border: 'border-blue-200',
    gradient: 'from-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    link: 'text-blue-600 hover:text-blue-700',
  },
  teal: {
    iconBg: 'bg-teal-100',
    iconText: 'text-teal-600',
    border: 'border-teal-200',
    gradient: 'from-teal-50',
    badge: 'bg-teal-100 text-teal-700',
    link: 'text-teal-600 hover:text-teal-700',
  },
  purple: {
    iconBg: 'bg-purple-100',
    iconText: 'text-purple-600',
    border: 'border-purple-200',
    gradient: 'from-purple-50',
    badge: 'bg-purple-100 text-purple-700',
    link: 'text-purple-600 hover:text-purple-700',
  },
}

interface ProductCardProps {
  product: Product
  showDescription?: boolean
}

export default function ProductCard({
  product,
  showDescription = true,
}: ProductCardProps) {
  const Icon = iconMap[product.icon]
  const colors = colorMap[product.color]
  const isComingSoon = product.status === 'coming-soon'

  const cardContent = (
    <div
      className={`relative bg-gradient-to-br ${colors.gradient} to-white rounded-2xl p-6 border ${colors.border} hover:shadow-lg transition-shadow group ${
        isComingSoon ? 'opacity-75' : ''
      }`}
    >
      {isComingSoon && (
        <div className="absolute top-4 right-4">
          <span className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-medium rounded-full">
            Coming Soon
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-10 h-10 ${colors.iconBg} rounded-lg flex items-center justify-center`}
        >
          {Icon && <Icon className={`w-5 h-5 ${colors.iconText}`} />}
        </div>
        <h3 className="text-lg font-bold text-slate-800">{product.name}</h3>
      </div>

      <p className="text-sm text-slate-500 mb-2">{product.tagline}</p>

      {showDescription && (
        <p className="text-sm text-slate-600 mb-4 line-clamp-2">
          {product.description}
        </p>
      )}

      {!isComingSoon && (
        <span
          className={`text-sm font-medium ${colors.link} inline-flex items-center gap-1 group-hover:gap-2 transition-all`}
        >
          Learn more
          <ArrowRight className="w-4 h-4" />
        </span>
      )}
    </div>
  )

  if (isComingSoon) {
    return cardContent
  }

  return (
    <Link href={`/products/${product.slug}`}>
      {cardContent}
    </Link>
  )
}
