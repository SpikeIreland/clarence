'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function TrainingSessionRedirect() {
    const router = useRouter()
    const params = useParams()
    const sessionId = params?.sessionId as string

    useEffect(() => {
        if (sessionId) {
            router.replace(`/auth/contract-studio?session_id=${sessionId}`)
        } else {
            router.replace('/auth/training')
        }
    }, [sessionId, router])

    return (
        <div className="min-h-screen bg-amber-50/30 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Redirecting to Contract Studio...</p>
            </div>
        </div>
    )
}
