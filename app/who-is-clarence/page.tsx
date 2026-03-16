import { Metadata } from 'next'
import MainNavigation from '@/app/components/MainNavigation'
import SectionCTA from '@/app/components/SectionCTA'
import Footer from '@/app/components/Footer'
import { Scale, Eye, Shield, ArrowDown } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Who is Clarence? | The Honest Broker',
  description:
    'Named after Clarence Darrow. Built on principled mediation. Clarence is the honest broker — a neutral intermediary that serves the agreement itself, not a side.',
}

export default function WhoIsClarencePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <MainNavigation />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-24 md:py-32">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-sm font-medium mb-10">
              <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">C</span>
              </div>
              <span className="text-emerald-300">The Honest Broker</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 tracking-tight leading-tight">
              We do not change people.{' '}
              <span className="text-emerald-400">
                We change the structure around them.
              </span>
            </h1>

            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Named after Clarence Darrow — the advocate who believed that
              fairness, not tactics, is the foundation of justice.
            </p>
          </div>
        </div>
      </section>

      {/* ── Origin Story ───────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-800 mb-8">
              Named After a Man Who Changed How Justice Worked
            </h2>

            <div className="space-y-6 text-lg text-slate-600 leading-relaxed">
              <p>
                Clarence Darrow was one of the most celebrated lawyers in
                American history — not because he won every case, but because he
                fought for what was right. He believed that the structure of the
                system mattered more than the tactics of the players. That
                fairness was not a weakness but a principle worth defending.
              </p>
              <p>
                We named our platform after him because we share that belief.
                Contract negotiation today is trapped in a structure that rewards
                posturing, concealment, and tactical brinkmanship. It does not
                have to be this way.
              </p>
              <p>
                Clarence — the platform — occupies a rare and deliberate
                position: a neutral, principled intermediary that exists to serve
                the agreement itself. Not one side. Not the other. The deal.
              </p>
            </div>

            <div className="mt-10 border-l-4 border-emerald-500 pl-6">
              <p className="text-xl italic text-slate-700 leading-relaxed">
                &ldquo;Like Darrow, Clarence is trusted not because it is
                powerful, but because it is fair. Not because it persuades, but
                because it reveals.&rdquo;
              </p>
              <p className="text-sm text-slate-400 mt-2">— The Clarence Charter</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Problem ────────────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-800 mb-10">
              Negotiation Today Is Broken
            </h2>

            <div className="space-y-4 mb-10">
              {[
                {
                  current: 'Adversarial',
                  could: 'collaborative',
                },
                {
                  current: 'Opaque',
                  could: 'transparent',
                },
                {
                  current: 'Slow',
                  could: 'decisive',
                },
                {
                  current: 'Expensive',
                  could: 'efficient',
                },
                {
                  current: 'Ego-driven',
                  could: 'principled',
                },
              ].map((item) => (
                <div
                  key={item.current}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200"
                >
                  <span className="text-lg font-semibold text-slate-800 min-w-[120px]">
                    {item.current}
                  </span>
                  <span className="text-slate-400">where it could be</span>
                  <span className="text-lg font-semibold text-emerald-600">
                    {item.could}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-l-4 border-slate-300 pl-6 mb-10">
              <p className="text-lg italic text-slate-600 leading-relaxed">
                &ldquo;Most negotiations begin with an unspoken truth: both
                parties already know roughly where they will land. Yet the ritual
                requires posturing, concealment, tactical brinkmanship, and
                drawn-out red-lining — all of which erode trust before a
                relationship has even begun.&rdquo;
              </p>
              <p className="text-sm text-slate-400 mt-2">— The Clarence Charter</p>
            </div>

            <p className="text-2xl font-bold text-slate-800">
              Clarence exists to challenge that ritual.
            </p>
          </div>
        </div>
      </section>

      {/* ── Three Pillars ──────────────────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Three Pillars
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Our identity rests on three principles that guide every decision we
              make.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center p-8 bg-emerald-50 rounded-2xl border border-emerald-200">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Scale className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">
                Neutrality
              </h3>
              <p className="text-slate-600">
                We serve both parties equally, without hidden incentives. The
                agreement is our client.
              </p>
            </div>

            <div className="text-center p-8 bg-slate-100 rounded-2xl border border-slate-200">
              <div className="w-14 h-14 bg-slate-200 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Eye className="w-7 h-7 text-slate-700" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">
                Transparency
              </h3>
              <p className="text-slate-600">
                We surface leverage, trade-offs, and constraints explicitly.
                Truth is safer to disclose.
              </p>
            </div>

            <div className="text-center p-8 bg-violet-50 rounded-2xl border border-violet-200">
              <div className="w-14 h-14 bg-violet-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-7 h-7 text-violet-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">
                Principle
              </h3>
              <p className="text-slate-600">
                We privilege durable, relationship-preserving outcomes over
                tactical advantage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Charter Assertions ─────────────────────────────────────────── */}
      <section className="py-20 bg-slate-800">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-400 mb-10 text-center uppercase tracking-wider">
              What Clarence Quietly Asserts
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                'Professionalism does not require hostility',
                'Fairness is not naivete',
                'Transparency is not weakness',
                'Risk reduction is a form of fairness',
                'This agreement reflects reality — not theatre',
              ].map((assertion) => (
                <div
                  key={assertion}
                  className="p-8 border border-slate-700 rounded-2xl"
                >
                  <p className="text-xl md:text-2xl font-bold text-white leading-snug">
                    {assertion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Purpose Cascade ────────────────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-slate-800 mb-12">
              Our Deeper Purpose
            </h2>

            <div className="space-y-6">
              <p className="text-xl font-semibold text-emerald-600">
                Better environments produce better decisions
              </p>
              <ArrowDown className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xl font-semibold text-slate-700">
                Better decisions produce better agreements
              </p>
              <ArrowDown className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xl font-semibold text-violet-600">
                Better agreements produce better relationships
              </p>
            </div>

            <div className="mt-16 border-t border-slate-200 pt-10">
              <p className="text-lg italic text-slate-500">
                This charter is not a constraint. It is a compass.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA + Footer ───────────────────────────────────────────────── */}
      <SectionCTA
        title="Ready to See What Principled Negotiation Looks Like?"
        subtitle="Experience the Clarence platform. Start with the Training Studio to rehearse, then bring those skills to your real agreements."
        primaryCTA={{ text: 'Request Free Trial', href: '/request-trial' }}
        secondaryCTA={{
          text: 'Try the Flight Simulator',
          href: '/products/training',
        }}
      />

      <Footer />
    </main>
  )
}
