import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Clarence | AI-powered contract mediation',
  description: 'AI-powered contract negotiation platform - The Honest Broker',
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800">
      <div className="container mx-auto px-6 py-8">
        {/* Navigation Bar */}
        <nav className="flex justify-between items-center mb-20">
          {/* How Clarence Works - Top Left */}
          <div>
            <a 
              href="/how-it-works" 
              className="text-slate-300 hover:text-white text-sm font-medium transition-colors duration-300 relative group"
            >
              How Clarence Works
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-slate-400 transition-all duration-300 group-hover:w-full"></span>
            </a>
          </div>
          
          {/* Sign In - Top Right */}
          <div>
            <a 
              href="/auth/login" 
              className="text-slate-300 hover:text-white text-sm font-medium transition-colors duration-300"
            >
              Sign In
            </a>
          </div>
        </nav>
        
        {/* Title & Tagline - Center Top */}
        <div className="text-center mb-24 animate-fade-in">
          <h1 className="text-4xl font-medium text-white mb-2 tracking-wide">
            CLARENCE
          </h1>
          <p className="text-base text-slate-400 font-light tracking-wider">
            The Honest Broker
          </p>
        </div>
        
        {/* Main Content - Center */}
        <div className="max-w-3xl mx-auto text-center">
          <div className="animate-fade-in-up" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
            <h2 className="text-2xl font-normal text-white mb-8 tracking-wide uppercase">
              AI-Powered Contract Negotiation
            </h2>
            <p className="text-base text-slate-300 leading-relaxed font-light max-w-2xl mx-auto">
              Clarence leads parties through an intuitive and structured negotiation process, 
              combining AI-powered insights with transparent brokering of compromises to 
              efficiently agree optimal contracts.
            </p>
          </div>
        </div>
        
        {/* Start Demo - Bottom */}
        <div className="flex justify-center mt-32 mb-16">
          <a 
            href="/chat" 
            className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-10 py-3 rounded-lg text-sm font-medium tracking-wide inline-block transform transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
          >
            Start Demo
          </a>
        </div>
      </div>
    </main>
  )
}