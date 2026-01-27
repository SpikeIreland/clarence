'use client'

import React from 'react'
import Link from 'next/link'

export default function CreateQuickContractPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-slate-800 mb-4">
                    Create Page Works!
                </h1>
                <p className="text-slate-600 mb-6">
                    If you can see this, the routing is working correctly.
                </p>
                <Link
                    href="/auth/quick-contract"
                    className="text-teal-600 hover:text-teal-700 font-medium"
                >
                    ← Back to Dashboard
                </Link>
            </div>
        </div>
    )
}