// ============================================================================
// CONTRACT STUDIO PREVIEW COMPONENT
// Displays a screenshot of the Contract Studio with a browser-style frame
// Location: app/components/ContractStudioPreview.tsx
// ============================================================================

export default function ContractStudioPreview() {
    return (
        <div className="max-w-5xl mx-auto">
            <div className="rounded-xl overflow-hidden shadow-2xl border border-slate-300 bg-slate-800">
                {/* ================================================================ */}
                {/* Browser Chrome Bar */}
                {/* ================================================================ */}
                <div className="bg-slate-700 px-4 py-2.5 flex items-center gap-3">
                    {/* Traffic Lights */}
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    </div>

                    {/* URL Bar */}
                    <div className="flex-1 mx-4">
                        <div className="bg-slate-600 rounded-md px-4 py-1.5 flex items-center justify-center gap-2">
                            <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-slate-300">clarencelegal.ai/contract-studio</span>
                        </div>
                    </div>

                    {/* Spacer for symmetry */}
                    <div className="w-16"></div>
                </div>

                {/* ================================================================ */}
                {/* Screenshot Image */}
                {/* ================================================================ */}
                <img
                    src="/images/contract-studio-preview.png"
                    alt="CLARENCE Contract Studio - AI-powered contract negotiation interface showing clause navigation, leverage tracking, position management, and AI mediator chat"
                    className="w-full h-auto block"
                />
            </div>

            {/* ================================================================== */}
            {/* Optional Caption */}
            {/* ================================================================== */}
            <p className="text-center text-sm text-slate-500 mt-4">
                The Contract Studio — where AI-mediated negotiation happens
            </p>
        </div>
    )
}