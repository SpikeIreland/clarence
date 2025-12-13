'use client'

// ============================================================================
// CONTRACT STUDIO PREVIEW COMPONENT
// Static, non-functional preview for homepage marketing
// ============================================================================

export default function ContractStudioPreview() {
    return (
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-w-4xl mx-auto">
            {/* ================================================================== */}
            {/* SECTION 1: MINI HEADER BAR */}
            {/* ================================================================== */}
            <div className="bg-slate-800 px-4 py-2.5">
                <div className="flex items-center justify-between">
                    {/* Left: Logo & Title */}
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded flex items-center justify-center">
                            <span className="text-white font-bold text-xs">C</span>
                        </div>
                        <span className="text-white text-sm font-medium">Contract Studio</span>
                    </div>

                    {/* Center: Parties */}
                    <div className="flex items-center gap-3">
                        <span className="text-emerald-400 text-xs font-medium px-2 py-0.5 bg-emerald-400/10 rounded">
                            Acme Corp
                        </span>
                        <span className="text-slate-500 text-xs">↔</span>
                        <span className="text-blue-400 text-xs font-medium px-2 py-0.5 bg-blue-400/10 rounded">
                            TechServe Ltd
                        </span>
                    </div>

                    {/* Right: Phase indicator */}
                    <div className="text-slate-400 text-xs">
                        Phase 3 • Gap Narrowing
                    </div>
                </div>
            </div>

            {/* ================================================================== */}
            {/* SECTION 2: THREE-PANEL LAYOUT */}
            {/* ================================================================== */}
            <div className="flex h-80">
                {/* ============================================================== */}
                {/* LEFT PANEL: Clause Navigation */}
                {/* ============================================================== */}
                <div className="w-48 bg-white border-r border-slate-200 flex flex-col">
                    {/* Stats Grid */}
                    <div className="p-2 border-b border-slate-100">
                        <div className="grid grid-cols-4 gap-1 text-center">
                            <div className="bg-emerald-50 rounded p-1">
                                <div className="text-sm font-bold text-emerald-600">12</div>
                                <div className="text-[8px] text-emerald-600">Aligned</div>
                            </div>
                            <div className="bg-amber-50 rounded p-1">
                                <div className="text-sm font-bold text-amber-600">8</div>
                                <div className="text-[8px] text-amber-600">Active</div>
                            </div>
                            <div className="bg-red-50 rounded p-1">
                                <div className="text-sm font-bold text-red-600">2</div>
                                <div className="text-[8px] text-red-600">Disputed</div>
                            </div>
                            <div className="bg-slate-50 rounded p-1">
                                <div className="text-sm font-bold text-slate-600">33</div>
                                <div className="text-[8px] text-slate-600">Pending</div>
                            </div>
                        </div>
                    </div>

                    {/* Clause Tree */}
                    <div className="flex-1 p-2 overflow-hidden">
                        {/* Category: Liability */}
                        <div className="mb-2">
                            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-50 rounded">
                                <svg className="w-3 h-3 text-slate-400 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span>Liability</span>
                            </div>
                            <div className="ml-3 mt-1 space-y-0.5">
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-slate-600 hover:bg-slate-50">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    <span className="text-slate-400">1.1</span>
                                    <span>Liability Cap</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    <span className="text-emerald-500">1.2</span>
                                    <span className="font-medium">Indemnification</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-slate-600 hover:bg-slate-50">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                    <span className="text-slate-400">1.3</span>
                                    <span>Exclusions</span>
                                </div>
                            </div>
                        </div>

                        {/* Category: Payment */}
                        <div className="mb-2">
                            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-50 rounded">
                                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span>Payment Terms</span>
                            </div>
                        </div>

                        {/* Category: Service Delivery */}
                        <div className="mb-2">
                            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-50 rounded">
                                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span>Service Delivery</span>
                            </div>
                        </div>

                        {/* Category: Termination */}
                        <div>
                            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-50 rounded">
                                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span>Termination</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ============================================================== */}
                {/* CENTER PANEL: Workspace */}
                {/* ============================================================== */}
                <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden">
                    {/* Leverage Indicator */}
                    <div className="p-3">
                        <div className="bg-white rounded-xl border border-slate-200 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-600">Leverage Position</span>
                                <span className="text-[10px] text-slate-400">Live Tracking</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-emerald-600">58%</span>
                                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full w-[58%] bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"></div>
                                </div>
                                <span className="text-xs font-bold text-blue-600">42%</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-[10px] text-emerald-600">Customer</span>
                                <span className="text-[10px] text-blue-600">Provider</span>
                            </div>
                        </div>
                    </div>

                    {/* Selected Clause Panel */}
                    <div className="flex-1 px-3 pb-3 overflow-hidden">
                        <div className="bg-white rounded-xl border border-slate-200 h-full flex flex-col">
                            {/* Clause Header */}
                            <div className="px-4 py-3 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 font-mono">1.2</span>
                                    <span className="text-sm font-semibold text-slate-800">Indemnification</span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                                        negotiating
                                    </span>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="px-4 py-2 border-b border-slate-100">
                                <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg w-fit">
                                    <button className="px-2 py-1 text-[10px] font-medium rounded bg-white text-slate-800 shadow-sm">
                                        Positions
                                    </button>
                                    <button className="px-2 py-1 text-[10px] font-medium rounded text-slate-500">
                                        Trade-offs
                                    </button>
                                    <button className="px-2 py-1 text-[10px] font-medium rounded text-slate-500">
                                        History
                                    </button>
                                </div>
                            </div>

                            {/* Position Sliders Mock */}
                            <div className="flex-1 p-4 space-y-4 overflow-hidden">
                                {/* Customer Position */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-medium text-emerald-600">Customer Position</span>
                                        <span className="text-[10px] text-slate-500">Mutual indemnification</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full">
                                        <div className="h-full w-[65%] bg-emerald-500 rounded-full relative">
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-emerald-500 rounded-full shadow"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Provider Position */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-medium text-blue-600">Provider Position</span>
                                        <span className="text-[10px] text-slate-500">Limited to fees paid</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full">
                                        <div className="h-full w-[35%] bg-blue-500 rounded-full relative">
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Gap Indicator */}
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-amber-700">Position Gap</span>
                                        <span className="text-xs font-bold text-amber-600">30%</span>
                                    </div>
                                    <p className="text-[10px] text-amber-600 mt-1">
                                        CLARENCE suggests exploring mutual caps with carve-outs
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ============================================================== */}
                {/* RIGHT PANEL: Chat */}
                {/* ============================================================== */}
                <div className="w-56 bg-white border-l border-slate-200 flex flex-col">
                    {/* Chat Header */}
                    <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold">C</span>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-slate-800">CLARENCE</div>
                                <div className="text-[9px] text-slate-500">Discussing: 1.2 Indemnification</div>
                            </div>
                        </div>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 p-2 space-y-2 overflow-hidden bg-slate-50">
                        {/* CLARENCE Message */}
                        <div className="flex justify-start">
                            <div className="max-w-[90%] bg-white rounded-lg p-2 border border-slate-200 shadow-sm">
                                <p className="text-[10px] text-slate-700 leading-relaxed">
                                    Based on industry standards, mutual indemnification with a cap of 2x annual fees is common in this sector. Would you like me to suggest specific language?
                                </p>
                                <div className="text-[8px] text-slate-400 mt-1">10:34 AM</div>
                            </div>
                        </div>

                        {/* Customer Message */}
                        <div className="flex justify-end">
                            <div className="max-w-[90%] bg-emerald-500 rounded-lg p-2">
                                <p className="text-[10px] text-white leading-relaxed">
                                    Yes, please show me the recommended clause language.
                                </p>
                                <div className="text-[8px] text-emerald-200 mt-1">10:35 AM</div>
                            </div>
                        </div>

                        {/* CLARENCE Typing */}
                        <div className="flex justify-start">
                            <div className="bg-white rounded-lg p-2 border border-slate-200">
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chat Input */}
                    <div className="p-2 border-t border-slate-200 bg-white">
                        <div className="flex gap-1">
                            <div className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-400">
                                Ask CLARENCE anything...
                            </div>
                            <div className="w-7 h-7 bg-emerald-500 rounded flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}