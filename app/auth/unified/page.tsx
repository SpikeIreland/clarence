// ========== SECTION: CONTRACT HEADER (Updated) ==========
// Location: In the Center Panel, within the Top Bar
// This section updates the contract header text to match John's requirements

{/* Contract Header - UPDATED SECTION */}
<div className="flex justify-between items-start mb-3">
  <div>
    <h1 className="text-xl font-bold text-gray-800">
      AI-Powered Contract Mediation
    </h1>
    <p className="text-sm text-gray-600 max-w-md">
      CLARENCE leads transparent negotiations between<br />
      customers and providers for optimal outcomes
    </p>
  </div>
  
  {/* Gamification Stats */}
  <div className="flex gap-4">
    {/* Tokens */}
    <div className="text-center">
      <div className="text-xs text-gray-500">Your Tokens</div>
      <div className="flex gap-1 mt-1">
        {[...Array(tokens.total)].map((_, i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded-full ${
              i < tokens.used ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
    
    {/* Achievements */}
    <div className="flex gap-2">
      {achievements.map(achievement => (
        <div
          key={achievement.id}
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            achievement.unlocked ? 'bg-yellow-100' : 'bg-gray-200'
          }`}
          title={achievement.title}
        >
          {achievement.unlocked ? achievement.icon : '🔒'}
        </div>
      ))}
    </div>
  </div>
</div>

// ========== ALTERNATIVE SECTION: HEADER WITH DYNAMIC CONTRACT INFO ==========
// If you want to keep the contract-specific information but add the tagline elsewhere

{/* Alternative Implementation - Adds a welcome banner */}
<div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 px-4 py-3 mb-4">
  <h2 className="text-lg font-semibold text-gray-800">AI-Powered Contract Mediation</h2>
  <p className="text-sm text-gray-600">
    CLARENCE leads transparent negotiations between<br />
    customers and providers for optimal outcomes
  </p>
</div>

{/* Then keep the original contract header below */}
<div className="flex justify-between items-start mb-3">
  <div>
    <h1 className="text-xl font-bold text-gray-800">
      Contract {selectedContract?.contractNumber}
    </h1>
    <p className="text-sm text-gray-600">
      {selectedContract?.serviceType} • {selectedContract?.customerCompany}
    </p>
  </div>
  {/* ... rest of gamification stats ... */}
</div>

// ========== SECTION: LEFT PANEL HEADER UPDATE (Optional Enhancement) ==========
// Location: In the Left Panel header area
// This adds the tagline to the CLARENCE branding if desired

{/* Header - ENHANCED VERSION */}
<div className="p-4 border-b border-slate-700">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-lg flex items-center justify-center font-bold text-white">
        C
      </div>
      <div>
        <div className="font-semibold">CLARENCE</div>
        <div className="text-xs text-slate-400">AI-Powered Mediation</div>
      </div>
    </div>
    <button 
      onClick={() => router.push('/auth/contracts-dashboard')}
      className="p-2 hover:bg-slate-700 rounded-lg transition"
      title="Back to Dashboard"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
  
  {/* Filter Tabs */}
  <div className="flex gap-2 text-xs">
    <button 
      onClick={() => setActiveFilter('active')}
      className={`px-3 py-1 rounded-md transition ${activeFilter === 'active' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
    >
      Active
    </button>
    <button 
      onClick={() => setActiveFilter('completed')}
      className={`px-3 py-1 rounded-md transition ${activeFilter === 'completed' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
    >
      Completed
    </button>
    <button 
      onClick={() => setActiveFilter('value')}
      className={`px-3 py-1 rounded-md transition ${activeFilter === 'value' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
    >
      By Value
    </button>
    <button 
      onClick={() => setActiveFilter('phase')}
      className={`px-3 py-1 rounded-md transition ${activeFilter === 'phase' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
    >
      By Phase
    </button>
  </div>
</div>