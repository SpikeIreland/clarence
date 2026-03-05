'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  ChevronDown,
  Menu,
  X,
  ArrowRight,
} from 'lucide-react'
import { products, productCategories } from '@/app/lib/products'

// ============================================================================
// MAIN NAVIGATION COMPONENT
// Location: app/components/MainNavigation.tsx
//
// Light-themed navigation with Products and Resources dropdowns.
// Sticky positioning. Mobile hamburger menu.
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

const colorMap: Record<string, string> = {
  emerald: 'text-emerald-600',
  slate: 'text-slate-700',
  violet: 'text-violet-600',
  amber: 'text-amber-600',
  blue: 'text-blue-600',
  teal: 'text-teal-600',
  purple: 'text-purple-600',
}

export default function MainNavigation() {
  const pathname = usePathname()
  const [productsOpen, setProductsOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const productsRef = useRef<HTMLDivElement>(null)
  const resourcesRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        productsRef.current &&
        !productsRef.current.contains(event.target as Node)
      ) {
        setProductsOpen(false)
      }
      if (
        resourcesRef.current &&
        !resourcesRef.current.contains(event.target as Node)
      ) {
        setResourcesOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
    setProductsOpen(false)
    setResourcesOpen(false)
  }, [pathname])

  const isActive = (path: string) => pathname === path
  const isProductsActive = pathname?.startsWith('/products')

  // Group products by category for dropdown
  const groupedProducts = productCategories
    .filter((cat) => cat.key !== 'coming-soon')
    .map((cat) => ({
      ...cat,
      items: products.filter((p) => p.category === cat.key),
    }))

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="container mx-auto px-6">
        <nav className="relative flex justify-between items-center h-16">
          {/* ── Logo & Brand ─────────────────────────────────────────── */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <div>
              <div className="font-semibold text-slate-800 tracking-wide">
                CLARENCE
              </div>
              <div className="text-xs text-slate-400 tracking-wider">Built to agree</div>
            </div>
          </Link>

          {/* ── Desktop Navigation ───────────────────────────────────── */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Products Dropdown */}
            <div ref={productsRef} className="relative">
              <button
                onClick={() => {
                  setProductsOpen(!productsOpen)
                  setResourcesOpen(false)
                }}
                className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isProductsActive || productsOpen
                    ? 'text-slate-900 bg-slate-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Products
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${productsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {productsOpen && (
                <div className="absolute top-full left-0 mt-2 w-[540px] bg-white rounded-xl shadow-xl border border-slate-200 p-6 animate-dropdown-enter">
                  <div className="grid grid-cols-2 gap-6">
                    {groupedProducts.map((group) => (
                      <div key={group.key}>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                          {group.label}
                        </h4>
                        <ul className="space-y-1">
                          {group.items.map((product) => {
                            const Icon = iconMap[product.icon]
                            return (
                              <li key={product.slug}>
                                <Link
                                  href={
                                    product.status === 'available'
                                      ? `/products/${product.slug}`
                                      : '/products'
                                  }
                                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors group"
                                  onClick={() => setProductsOpen(false)}
                                >
                                  {Icon && (
                                    <Icon
                                      className={`w-4 h-4 ${colorMap[product.color]}`}
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-700 group-hover:text-slate-900 flex items-center gap-2">
                                      {product.name}
                                      {product.status === 'coming-soon' && (
                                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                                          Soon
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-400 truncate">
                                      {product.tagline}
                                    </div>
                                  </div>
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 mt-4 pt-4">
                    <Link
                      href="/products"
                      className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                      onClick={() => setProductsOpen(false)}
                    >
                      View all products
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Platform */}
            <Link
              href="/how-it-works"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive('/how-it-works')
                  ? 'text-slate-900 bg-slate-100'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Platform
            </Link>

            {/* Pricing */}
            <Link
              href="/pricing"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive('/pricing')
                  ? 'text-slate-900 bg-slate-100'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Pricing
            </Link>

            {/* Who is Clarence? */}
            <Link
              href="/who-is-clarence"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive('/who-is-clarence')
                  ? 'text-slate-900 bg-slate-100'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Who is Clarence?
            </Link>

            {/* Resources Dropdown */}
            <div ref={resourcesRef} className="relative">
              <button
                onClick={() => {
                  setResourcesOpen(!resourcesOpen)
                  setProductsOpen(false)
                }}
                className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  resourcesOpen
                    ? 'text-slate-900 bg-slate-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Resources
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${resourcesOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {resourcesOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 animate-dropdown-enter">
                  <Link
                    href="/how-it-works"
                    className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-slate-50 transition-colors"
                    onClick={() => setResourcesOpen(false)}
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        How It Works
                      </div>
                      <div className="text-xs text-slate-400">
                        The Create / Negotiate / Agree journey
                      </div>
                    </div>
                  </Link>
                  <Link
                    href="/enterprise"
                    className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-slate-50 transition-colors"
                    onClick={() => setResourcesOpen(false)}
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        Enterprise
                      </div>
                      <div className="text-xs text-slate-400">
                        For large organisations
                      </div>
                    </div>
                  </Link>
                  <Link
                    href="/request-trial"
                    className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-slate-50 transition-colors"
                    onClick={() => setResourcesOpen(false)}
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        Request Trial
                      </div>
                      <div className="text-xs text-slate-400">
                        Start your free evaluation
                      </div>
                    </div>
                  </Link>
                  <Link
                    href="/who-is-clarence"
                    className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-slate-50 transition-colors"
                    onClick={() => setResourcesOpen(false)}
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        Who is Clarence?
                      </div>
                      <div className="text-xs text-slate-400">
                        The Honest Broker story
                      </div>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* ── Desktop CTA Buttons ──────────────────────────────────── */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/request-trial"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Request Trial
            </Link>
          </div>

          {/* ── Mobile Hamburger ──────────────────────────────────────── */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900"
          >
            {mobileOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </nav>
      </div>

      {/* ── Mobile Menu ────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white animate-slide-in-down">
          <div className="container mx-auto px-6 py-4 space-y-1">
            {/* Products section */}
            <div className="py-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">
                Products
              </div>
              {products
                .filter((p) => p.status === 'available')
                .map((product) => {
                  const Icon = iconMap[product.icon]
                  return (
                    <Link
                      key={product.slug}
                      href={`/products/${product.slug}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      {Icon && (
                        <Icon
                          className={`w-4 h-4 ${colorMap[product.color]}`}
                        />
                      )}
                      <span className="text-sm text-slate-700">
                        {product.name}
                      </span>
                    </Link>
                  )
                })}
              <Link
                href="/products"
                className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 font-medium"
              >
                View all products
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="border-t border-slate-100 my-2"></div>

            {/* Main links */}
            <Link
              href="/how-it-works"
              className={`block px-3 py-2 text-sm rounded-lg ${
                isActive('/how-it-works')
                  ? 'text-slate-900 bg-slate-100 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Platform
            </Link>
            <Link
              href="/pricing"
              className={`block px-3 py-2 text-sm rounded-lg ${
                isActive('/pricing')
                  ? 'text-slate-900 bg-slate-100 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Pricing
            </Link>
            <Link
              href="/enterprise"
              className="block px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg"
            >
              Enterprise
            </Link>
            <Link
              href="/who-is-clarence"
              className={`block px-3 py-2 text-sm rounded-lg ${
                isActive('/who-is-clarence')
                  ? 'text-slate-900 bg-slate-100 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Who is Clarence?
            </Link>

            <div className="border-t border-slate-100 my-2"></div>

            {/* CTAs */}
            <div className="space-y-2 pt-2">
              <Link
                href="/auth/login"
                className="block w-full px-4 py-2.5 text-center text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/request-trial"
                className="block w-full px-4 py-2.5 text-center text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
              >
                Request Trial
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
