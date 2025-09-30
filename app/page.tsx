export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <nav className="flex justify-between items-center mb-16">
          <h1 className="text-3xl font-bold text-white">CLARENCE</h1>
          <div className="space-x-6">
            <button className="text-white/80 hover:text-white transition">Platform</button>
            <a href="/auth/login" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition inline-block">
            Sign In
            </a>
          </div>
        </nav>
        
        <div className="max-w-4xl mx-auto text-center mt-32">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            AI-Powered Contract Mediation
          </h2>
          <p className="text-xl text-white/80 mb-12 max-w-2xl mx-auto">
            Transform complex B2B negotiations through intelligent mediation. 
            CLARENCE facilitates faster agreements with better outcomes for all parties.
          </p>
          
          <div className="flex gap-4 justify-center mb-16">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition">
              Start Demo
            </button>
            <button className="border border-white/30 hover:border-white/50 text-white px-8 py-4 rounded-lg text-lg transition">
              Learn More
            </button>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mt-24">
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <h3 className="text-white font-semibold text-lg mb-2">Preliminary Assessment</h3>
              <p className="text-white/70">Quick analysis of contract terms and negotiation points</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <h3 className="text-white font-semibold text-lg mb-2">Intelligent Drafting</h3>
              <p className="text-white/70">AI-assisted contract creation with balanced terms</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <h3 className="text-white font-semibold text-lg mb-2">Real-Time Mediation</h3>
              <p className="text-white/70">Live negotiation support with CLARENCE AI</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
