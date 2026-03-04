import { CheckCircle2 } from 'lucide-react'

// ============================================================================
// FEATURE LIST ITEM COMPONENT
// Location: app/components/FeatureListItem.tsx
//
// Reusable check-mark + text pattern that replaces 40+ inline SVG instances
// across public pages.
// ============================================================================

const colorMap = {
  emerald: 'text-emerald-500',
  slate: 'text-slate-600',
  violet: 'text-violet-500',
  amber: 'text-amber-500',
  blue: 'text-blue-500',
  teal: 'text-teal-500',
  purple: 'text-purple-500',
}

interface FeatureListItemProps {
  children: React.ReactNode
  color?: keyof typeof colorMap
}

export default function FeatureListItem({
  children,
  color = 'emerald',
}: FeatureListItemProps) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle2
        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${colorMap[color]}`}
      />
      <span className="text-sm text-slate-600">{children}</span>
    </li>
  )
}
