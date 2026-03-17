import { Metadata } from 'next'
import MainNavigation from '../components/MainNavigation'
import PageHero from '../components/PageHero'
import ProductCard from '../components/ProductCard'
import SectionCTA from '../components/SectionCTA'
import Footer from '../components/Footer'
import { products, productCategories } from '../lib/products'

export const metadata: Metadata = {
  title: 'Products | CLARENCE - The Agreement Suite',
  description:
    'Explore the complete Clarence product suite. Principled tools for contract creation, negotiation, training, signing, and knowledge management.',
}

// ============================================================================
// PRODUCTS OVERVIEW PAGE
// Location: app/products/page.tsx
//
// Full grid of all products grouped by category.
// ============================================================================

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <MainNavigation />

      <PageHero
        badge={{ icon: 'C', text: 'Product Suite' }}
        title="Tools Built to Agree"
        subtitle="A professional excellence platform — every product built on the same principled methodology, from Academy certification to live agreement."
      />

      {/* ================================================================== */}
      {/* PRODUCT CATEGORIES                                                  */}
      {/* ================================================================== */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto space-y-16">
            {productCategories.map((category) => {
              const categoryProducts = products.filter(
                (p) => p.category === category.key
              )
              if (categoryProducts.length === 0) return null

              return (
                <div key={category.key}>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">
                    {category.label}
                  </h2>
                  <div className="w-12 h-1 bg-emerald-500 rounded-full mb-8"></div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categoryProducts.map((product) => (
                      <ProductCard key={product.slug} product={product} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* JOURNEY TIE-IN                                                      */}
      {/* ================================================================== */}
      <section className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm text-slate-400 uppercase tracking-wider mb-4">
            The Clarence Methodology
          </p>
          <div className="text-2xl font-bold flex items-baseline justify-center gap-2 mb-4">
            <span className="text-emerald-600">Create</span>
            <span className="text-slate-300 font-light">·</span>
            <span className="text-slate-800">Negotiate</span>
            <span className="text-slate-300 font-light">·</span>
            <span className="text-violet-600">Agree</span>
          </div>
          <p className="text-slate-600 max-w-xl mx-auto">
            Every Clarence product follows the same principled methodology —
            because better environments produce better practitioners, and
            better practitioners produce better agreements.
          </p>
        </div>
      </section>

      <SectionCTA
        title="Ready to Get Started?"
        subtitle="Start with a free trial or explore our pricing to find the right plan for your team."
        primaryCTA={{ text: 'Request Free Trial', href: '/request-trial' }}
        secondaryCTA={{ text: 'View Pricing', href: '/pricing' }}
      />

      <Footer />
    </main>
  )
}
