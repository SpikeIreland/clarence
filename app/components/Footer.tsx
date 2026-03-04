import Link from 'next/link'
import { products } from '@/app/lib/products'

// ============================================================================
// FOOTER COMPONENT
// Location: app/components/Footer.tsx
//
// Shared footer for all public pages. Replaces the duplicated inline footer
// that previously appeared in each page file.
// Multi-column layout with product links, resources, and company links.
// ============================================================================

export default function Footer() {
  const availableProducts = products.filter((p) => p.status === 'available')

  return (
    <footer className="bg-slate-900 text-slate-400 py-16">
      <div className="container mx-auto px-6">
        {/* Multi-column grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Column 1: Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">C</span>
              </div>
              <div>
                <div className="text-white font-semibold">CLARENCE</div>
                <div className="text-slate-500 text-xs">The Honest Broker</div>
              </div>
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed">
              AI-powered contract intelligence platform. From creation to
              signature — fair, transparent, principled.
            </p>
          </div>

          {/* Column 2: Products */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Products</h4>
            <ul className="space-y-2">
              {availableProducts.map((product) => (
                <li key={product.slug}>
                  <Link
                    href={`/products/${product.slug}`}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {product.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/products"
                  className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  View all products
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">
              Resources
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/how-it-works"
                  className="text-sm hover:text-white transition-colors"
                >
                  How It Works
                </Link>
              </li>
              <li>
                <Link
                  href="/products/training"
                  className="text-sm hover:text-white transition-colors"
                >
                  Training Studio
                </Link>
              </li>
              <li>
                <Link
                  href="/enterprise"
                  className="text-sm hover:text-white transition-colors"
                >
                  Enterprise
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-sm hover:text-white transition-colors"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/request-trial"
                  className="text-sm hover:text-white transition-colors"
                >
                  Request Trial
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Company */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Company</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://dataroom.clarencelegal.ai"
                  className="text-sm hover:text-white transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Investor Data Room
                </a>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm hover:text-white transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} CLARENCE. The Honest Broker.
          </p>
          <p className="text-sm">
            <span className="text-emerald-500">Create</span>
            <span className="mx-2">·</span>
            <span className="text-slate-400">Negotiate</span>
            <span className="mx-2">·</span>
            <span className="text-violet-500">Agree</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
