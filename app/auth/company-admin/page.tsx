'use client'
import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

interface UserInfo {
    userId: string
    email: string
    firstName?: string
    lastName?: string
    company?: string
    companyId?: string
    role?: string
}

interface CompanyUser {
    id: string
    userId?: string
    email: string
    fullName: string
    role: 'admin' | 'manager' | 'user' | 'viewer'
    status: 'invited' | 'active' | 'suspended' | 'removed'
    invitedAt: string
    lastActiveAt?: string
}

interface TrainingUser {
    id: string
    userId?: string
    email: string
    fullName: string
    approvalType: 'training_partner' | 'training_admin' | 'ai_enabled'
    status: 'pending' | 'active' | 'suspended' | 'expired'
    invitedAt: string
    approvedAt?: string
    sessionsCompleted: number
    invitationSent: boolean
}

interface Playbook {
    playbookId: string
    playbookName: string
    playbookVersion?: string
    playbookDescription?: string
    playbookSummary?: string
    status: 'pending_parse' | 'parsing' | 'parsed' | 'review_required' | 'active' | 'inactive' | 'superseded' | 'parse_failed'
    isActive: boolean
    sourceFileName?: string
    sourceFilePath?: string
    rulesExtracted: number
    aiConfidenceScore?: number
    effectiveDate?: string
    expiryDate?: string
    createdAt: string
    createdBy?: string
    parsingError?: string
}

type AdminTab = 'playbooks' | 'training' | 'users' | 'audit'

// ============================================================================
// SECTION 2: API CONFIGURATION
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// ============================================================================
// SECTION 3: LOADING COMPONENT
// ============================================================================

function CompanyAdminLoading() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading Company Admin...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 4: TAB NAVIGATION COMPONENT
// ============================================================================

interface TabNavigationProps {
    activeTab: AdminTab
    onTabChange: (tab: AdminTab) => void
    pendingCount: { training: number; users: number }
}

function TabNavigation({ activeTab, onTabChange, pendingCount }: TabNavigationProps) {
    const tabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
        { id: 'playbooks', label: 'Playbooks', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
        { id: 'training', label: 'Training Access', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>, badge: pendingCount.training > 0 ? pendingCount.training : undefined },
        { id: 'users', label: 'Users', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>, badge: pendingCount.users > 0 ? pendingCount.users : undefined },
        { id: 'audit', label: 'Audit Log', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> }
    ]

    return (
        <div className="border-b border-slate-200 bg-white">
            <nav className="flex space-x-1 px-6" aria-label="Tabs">
                {tabs.map((tab) => (
                    <button key={tab.id} onClick={() => onTabChange(tab.id)}
                        className={`relative flex items-center gap-2 px-4 py-4 text-sm font-medium transition-all ${activeTab === tab.id ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                        {tab.icon}
                        {tab.label}
                        {tab.badge && <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full">{tab.badge}</span>}
                    </button>
                ))}
            </nav>
        </div>
    )
}

// ============================================================================
// SECTION 5: PLAYBOOKS TAB COMPONENT
// ============================================================================

interface PlaybooksTabProps {
    playbooks: Playbook[]
    isLoading: boolean
    onUpload: (file: File) => Promise<void>
    onActivate: (playbookId: string) => Promise<void>
    onDeactivate: (playbookId: string) => Promise<void>
    onParse: (playbookId: string) => Promise<void>
    onDelete: (playbookId: string, sourceFilePath?: string) => Promise<void>
    onDownload: (sourceFilePath: string, fileName: string) => Promise<void>
    onRefresh: () => void
}

function PlaybooksTab({ playbooks, isLoading, onUpload, onActivate, onDeactivate, onParse, onDelete, onDownload, onRefresh }: PlaybooksTabProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [parsingId, setParsingId] = useState<string | null>(null)
    const [parseError, setParseError] = useState<string | null>(null)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenuId(null)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleFileUpload = async (file: File) => {
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        if (!allowedTypes.includes(file.type)) { setUploadError('Please upload a PDF or Word document'); return }
        if (file.size > 10 * 1024 * 1024) { setUploadError('File size must be less than 10MB'); return }
        setIsUploading(true); setUploadError(null)
        try { await onUpload(file) } catch (e) { setUploadError(e instanceof Error ? e.message : 'Failed to upload') } finally { setIsUploading(false) }
    }

    const handleParseClick = async (playbookId: string) => {
        console.log('=== PARSE BUTTON CLICKED ===', playbookId)
        setParsingId(playbookId); setParseError(null)
        try { await onParse(playbookId) } catch (e) { console.error('Parse error:', e); setParseError(e instanceof Error ? e.message : 'Failed to parse') } finally { setParsingId(null) }
    }

    const getStatusBadge = (status: Playbook['status'], isActive: boolean) => {
        if (isActive) return <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">Active</span>
        const c: Record<string, { bg: string; text: string; label: string }> = {
            pending_parse: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Pending Processing' },
            parsing: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Processing...' },
            parsed: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Ready to Activate' },
            review_required: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Review Required' },
            inactive: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Inactive' },
            parse_failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Parse Failed' }
        }
        const cfg = c[status] || { bg: 'bg-slate-100', text: 'text-slate-500', label: status }
        return <span className={`px-2 py-1 text-xs font-medium ${cfg.bg} ${cfg.text} rounded-full`}>{cfg.label}</span>
    }

    return (
        <div className="p-6">
            {/* Upload Section */}
            <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Upload Playbook</h3>
                <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'} ${isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
                    <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploading} />
                    {isUploading ? (<div className="flex flex-col items-center"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-slate-600">Uploading...</p></div>
                    ) : (<><div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center"><svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg></div><p className="text-slate-700 font-medium mb-1">Drag and drop your playbook here</p><p className="text-sm text-slate-500">PDF, DOC, DOCX - max 10MB</p></>)}
                </div>
                {uploadError && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{uploadError}</div>}
                {parseError && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{parseError}</div>}
            </div>

            {/* Playbooks List */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Your Playbooks ({playbooks.length})</h3>
                <button onClick={onRefresh} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Refresh</button>
            </div>

            {isLoading ? (<div className="text-center py-12"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div></div>
            ) : playbooks.length === 0 ? (<div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200"><p className="text-slate-600 font-medium">No playbooks uploaded yet</p></div>
            ) : (<div className="space-y-4">
                {playbooks.map((p) => (
                    <div key={p.playbookId} className={`p-4 rounded-xl border ${p.isActive ? 'bg-emerald-50 border-emerald-200' : deletingId === p.playbookId ? 'bg-red-50 border-red-200 opacity-50' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2"><h4 className="font-semibold text-slate-800">{p.playbookName}</h4>{getStatusBadge(p.status, p.isActive)}</div>
                                {p.playbookSummary && <p className="text-sm text-slate-600 mb-3 line-clamp-2">{p.playbookSummary}</p>}
                                {p.parsingError && <p className="text-sm text-red-600 mb-3">Error: {p.parsingError}</p>}
                                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                                    {p.sourceFileName && <span>{p.sourceFileName}</span>}
                                    <span>{p.rulesExtracted} rules</span>
                                    {p.aiConfidenceScore != null && <span>{Math.round(p.aiConfidenceScore * 100)}% confidence</span>}
                                    <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                                {(p.status === 'pending_parse' || p.status === 'parse_failed') && (
                                    <button onClick={() => handleParseClick(p.playbookId)} disabled={parsingId === p.playbookId}
                                        className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                                        {parsingId === p.playbookId ? 'Processing...' : p.status === 'parse_failed' ? 'Retry Parse' : 'Parse Playbook'}
                                    </button>
                                )}
                                {p.status === 'parsing' && <span className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg">Parsing...</span>}
                                {p.isActive ? (<button onClick={() => onDeactivate(p.playbookId)} className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg">Deactivate</button>
                                ) : (p.status === 'parsed' || p.status === 'inactive') && (<button onClick={() => onActivate(p.playbookId)} className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Activate</button>)}
                                <div className="relative" ref={openMenuId === p.playbookId ? menuRef : null}>
                                    <button onClick={() => setOpenMenuId(openMenuId === p.playbookId ? null : p.playbookId)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" /></svg>
                                    </button>
                                    {openMenuId === p.playbookId && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                                            {p.sourceFilePath && <button onClick={() => { onDownload(p.sourceFilePath!, p.sourceFileName || 'playbook'); setOpenMenuId(null) }} className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Download Document</button>}
                                            <div className="border-t border-slate-100 my-1"></div>
                                            {showDeleteConfirm === p.playbookId ? (
                                                <div className="px-4 py-2"><p className="text-xs text-red-600 mb-2">Delete this playbook?</p><div className="flex gap-2">
                                                    <button onClick={() => { setDeletingId(p.playbookId); onDelete(p.playbookId, p.sourceFilePath).finally(() => { setDeletingId(null); setShowDeleteConfirm(null); setOpenMenuId(null) }) }} className="px-2 py-1 text-xs text-white bg-red-600 hover:bg-red-700 rounded">Yes</button>
                                                    <button onClick={() => setShowDeleteConfirm(null)} className="px-2 py-1 text-xs text-slate-600 bg-slate-100 rounded">Cancel</button>
                                                </div></div>
                                            ) : (<button onClick={() => setShowDeleteConfirm(p.playbookId)} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">Delete Playbook</button>)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>)}
        </div>
    )
}

// ============================================================================
// SECTION 6: TRAINING ACCESS TAB COMPONENT
// ============================================================================

interface TrainingTabProps { users: TrainingUser[]; isLoading: boolean; onAddUser: (email: string, fullName: string, approvalType: string) => Promise<void>; onRemoveUser: (id: string) => Promise<void>; onSendInvite: (id: string, email: string) => Promise<void>; onRefresh: () => void }

function TrainingAccessTab({ users, isLoading, onAddUser, onRemoveUser, onSendInvite, onRefresh }: TrainingTabProps) {
    const [showForm, setShowForm] = useState(false)
    const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [type, setType] = useState('training_partner')
    const [isAdding, setIsAdding] = useState(false); const [error, setError] = useState<string | null>(null); const [sendingId, setSendingId] = useState<string | null>(null)

    const handleAdd = async () => {
        if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email'); return }
        setIsAdding(true); setError(null)
        try { await onAddUser(email.trim(), name.trim(), type); setEmail(''); setName(''); setShowForm(false) } catch (e) { setError(e instanceof Error ? e.message : 'Failed') } finally { setIsAdding(false) }
    }

    const handleInvite = async (id: string, email: string) => { setSendingId(id); try { await onSendInvite(id, email) } finally { setSendingId(null) } }

    const getStatusBadge = (s: string) => {
        const c: Record<string, string> = { pending: 'bg-amber-100 text-amber-700', active: 'bg-emerald-100 text-emerald-700', suspended: 'bg-slate-100 text-slate-600', expired: 'bg-red-100 text-red-700' }
        return <span className={`px-2 py-1 text-xs font-medium ${c[s] || c.pending} rounded-full capitalize`}>{s}</span>
    }
    const getTypeBadge = (t: string) => {
        const l: Record<string, string> = { training_admin: 'Admin', training_partner: 'Partner', ai_enabled: 'AI Enabled' }
        return <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">{l[t] || t}</span>
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div><h3 className="text-lg font-semibold text-slate-800">Training Studio Access</h3><p className="text-sm text-slate-500 mt-1">Manage who can access the Training Studio</p></div>
                <div className="flex gap-2">
                    <button onClick={onRefresh} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Refresh</button>
                    <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Add User</button>
                </div>
            </div>

            {showForm && (
                <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <h4 className="font-medium text-slate-800 mb-4">Add Training User</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Email *</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" /></div>
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" /></div>
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Access Type</label><select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"><option value="training_partner">Training Partner</option><option value="training_admin">Training Admin</option><option value="ai_enabled">AI Enabled</option></select></div>
                        <div className="flex items-end gap-2"><button onClick={handleAdd} disabled={isAdding} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50">{isAdding ? 'Adding...' : 'Add & Send Invite'}</button><button onClick={() => { setShowForm(false); setError(null) }} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg">Cancel</button></div>
                    </div>
                    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </div>
            )}

            {isLoading ? <div className="text-center py-12"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
                : users.length === 0 ? <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200"><p className="text-slate-600 font-medium">No training users yet</p></div>
                    : (
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">User</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Access</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Sessions</th><th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th></tr></thead>
                                <tbody className="divide-y divide-slate-200">
                                    {users.map((u) => (
                                        <tr key={u.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3"><p className="font-medium text-slate-800">{u.fullName || 'Unnamed'}</p><p className="text-sm text-slate-500">{u.email}</p></td>
                                            <td className="px-4 py-3">{getTypeBadge(u.approvalType)}</td>
                                            <td className="px-4 py-3">{getStatusBadge(u.status)}</td>
                                            <td className="px-4 py-3 text-sm text-slate-600">{u.sessionsCompleted}</td>
                                            <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-2">
                                                {!u.invitationSent && <button onClick={() => handleInvite(u.id, u.email)} disabled={sendingId === u.id} className="px-3 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded disabled:opacity-50">{sendingId === u.id ? 'Sending...' : 'Send Invite'}</button>}
                                                <button onClick={() => onRemoveUser(u.id)} className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded">Remove</button>
                                            </div></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
        </div>
    )
}

// ============================================================================
// SECTION 7: USERS TAB COMPONENT
// ============================================================================

interface UsersTabProps { users: CompanyUser[]; isLoading: boolean; onAddUser: (email: string, fullName: string, role: string) => Promise<void>; onRemoveUser: (id: string) => Promise<void>; onSendInvite: (id: string, email: string) => Promise<void>; onRefresh: () => void }

function UsersTab({ users, isLoading, onAddUser, onRemoveUser, onSendInvite, onRefresh }: UsersTabProps) {
    const [showForm, setShowForm] = useState(false)
    const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [role, setRole] = useState('user')
    const [isAdding, setIsAdding] = useState(false); const [error, setError] = useState<string | null>(null); const [sendingId, setSendingId] = useState<string | null>(null)

    const handleAdd = async () => {
        if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email'); return }
        setIsAdding(true); setError(null)
        try { await onAddUser(email.trim(), name.trim(), role); setEmail(''); setName(''); setShowForm(false) } catch (e) { setError(e instanceof Error ? e.message : 'Failed') } finally { setIsAdding(false) }
    }

    const handleInvite = async (id: string, email: string) => { setSendingId(id); try { await onSendInvite(id, email) } finally { setSendingId(null) } }

    const getRoleBadge = (r: string) => {
        const c: Record<string, string> = { admin: 'bg-purple-100 text-purple-700', manager: 'bg-blue-100 text-blue-700', user: 'bg-slate-100 text-slate-600', viewer: 'bg-gray-100 text-gray-600' }
        return <span className={`px-2 py-1 text-xs font-medium ${c[r] || c.user} rounded-full capitalize`}>{r}</span>
    }
    const getStatusBadge = (s: string) => {
        const c: Record<string, string> = { invited: 'bg-amber-100 text-amber-700', active: 'bg-emerald-100 text-emerald-700', suspended: 'bg-red-100 text-red-700', removed: 'bg-slate-100 text-slate-400' }
        return <span className={`px-2 py-1 text-xs font-medium ${c[s] || c.invited} rounded-full capitalize`}>{s}</span>
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div><h3 className="text-lg font-semibold text-slate-800">Company Users</h3><p className="text-sm text-slate-500 mt-1">Manage your team members</p></div>
                <div className="flex gap-2">
                    <button onClick={onRefresh} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Refresh</button>
                    <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Invite User</button>
                </div>
            </div>

            {showForm && (
                <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <h4 className="font-medium text-slate-800 mb-4">Invite New User</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Email *</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" /></div>
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" /></div>
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Role</label><select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"><option value="user">User</option><option value="manager">Manager</option><option value="admin">Admin</option><option value="viewer">Viewer</option></select></div>
                        <div className="flex items-end gap-2"><button onClick={handleAdd} disabled={isAdding} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50">{isAdding ? 'Sending...' : 'Send Invitation'}</button><button onClick={() => { setShowForm(false); setError(null) }} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg">Cancel</button></div>
                    </div>
                    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </div>
            )}

            {isLoading ? <div className="text-center py-12"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
                : users.length === 0 ? <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200"><p className="text-slate-600 font-medium">No users yet</p></div>
                    : (
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">User</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Role</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th><th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Joined</th><th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th></tr></thead>
                                <tbody className="divide-y divide-slate-200">
                                    {users.map((u) => (
                                        <tr key={u.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3"><p className="font-medium text-slate-800">{u.fullName || 'Unnamed'}</p><p className="text-sm text-slate-500">{u.email}</p></td>
                                            <td className="px-4 py-3">{getRoleBadge(u.role)}</td>
                                            <td className="px-4 py-3">{getStatusBadge(u.status)}</td>
                                            <td className="px-4 py-3 text-sm text-slate-600">{new Date(u.invitedAt).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-2">
                                                {u.status === 'invited' && <button onClick={() => handleInvite(u.id, u.email)} disabled={sendingId === u.id} className="px-3 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded disabled:opacity-50">{sendingId === u.id ? 'Sending...' : 'Resend'}</button>}
                                                <button onClick={() => onRemoveUser(u.id)} className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded">Remove</button>
                                            </div></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
        </div>
    )
}

// ============================================================================
// SECTION 8: AUDIT LOG TAB (PLACEHOLDER)
// ============================================================================

function AuditLogTab() {
    return (<div className="p-6"><div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200"><p className="text-slate-600 font-medium mb-1">Audit Log</p><p className="text-sm text-slate-500">Coming soon - view history of all admin actions</p></div></div>)
}

// ============================================================================
// SECTION 9: MAIN COMPANY ADMIN CONTENT
// ============================================================================

function CompanyAdminContent() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [companyName, setCompanyName] = useState('')
    const [activeTab, setActiveTab] = useState<AdminTab>('playbooks')
    const [isAdmin, setIsAdmin] = useState(false)
    const [playbooks, setPlaybooks] = useState<Playbook[]>([])
    const [playbooksLoading, setPlaybooksLoading] = useState(false)
    const [trainingUsers, setTrainingUsers] = useState<TrainingUser[]>([])
    const [trainingLoading, setTrainingLoading] = useState(false)
    const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
    const [usersLoading, setUsersLoading] = useState(false)

    const checkAuth = useCallback(async (): Promise<UserInfo | null> => {
        try {
            const supabase = createClient()
            const { data: { user }, error } = await supabase.auth.getUser()
            if (error || !user) { router.push('/auth/login'); return null }
            let companyId = user.user_metadata?.company_id
            if (!companyId) { const { data } = await supabase.from('company_users').select('company_id').eq('email', user.email).eq('status', 'active').single(); companyId = data?.company_id }
            if (!companyId) { const { data } = await supabase.from('companies').select('company_id').limit(1).single(); companyId = data?.company_id }
            console.log('Auth:', user.email, 'Company:', companyId)
            return { userId: user.id, email: user.email || '', firstName: user.user_metadata?.first_name || '', lastName: user.user_metadata?.last_name || '', company: user.user_metadata?.company || '', companyId: companyId || '', role: 'customer' }
        } catch (e) { console.error('Auth error:', e); router.push('/auth/login'); return null }
    }, [router])

    const checkAdminAccess = useCallback(async (email: string, companyId?: string): Promise<boolean> => {
        if (['paul.lyons67@icloud.com'].includes(email.toLowerCase())) return true
        if (companyId) { const supabase = createClient(); const { data } = await supabase.from('company_users').select('role').eq('email', email).eq('company_id', companyId).eq('status', 'active').single(); if (data?.role === 'admin') return true }
        return false
    }, [])

    const loadPlaybooks = useCallback(async (companyId: string) => {
        console.log('=== loadPlaybooks ===', companyId)
        setPlaybooksLoading(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase.from('company_playbooks').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
            console.log('Playbooks:', { data, error })
            if (error) { if (error.code === '42P01') { setPlaybooks([]); return }; throw error }
            setPlaybooks((data || []).map(p => ({ playbookId: p.playbook_id, playbookName: p.playbook_name, playbookVersion: p.playbook_version, playbookDescription: p.playbook_description, playbookSummary: p.playbook_summary, status: p.status, isActive: p.is_active || false, sourceFileName: p.source_file_name, sourceFilePath: p.source_file_path, rulesExtracted: p.rules_extracted || 0, aiConfidenceScore: p.ai_confidence_score, effectiveDate: p.effective_date, expiryDate: p.expiry_date, createdAt: p.created_at, createdBy: p.created_by, parsingError: p.parsing_error })))
        } catch (e) { console.error('Load playbooks error:', e); setPlaybooks([]) } finally { setPlaybooksLoading(false) }
    }, [])

// ========================================================================
// SECTION 9B: DATA LOADING - loadTrainingUsers (CORRECTED)
// ========================================================================

const loadTrainingUsers = useCallback(async (companyId: string) => {
    setTrainingLoading(true)
    try {
        const supabase = createClient()
        
        // First, try to use the view if it exists
        const { data: viewData, error: viewError } = await supabase
            .from('training_users_with_email')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })

        if (!viewError && viewData) {
            // View exists - use it
            const mapped: TrainingUser[] = viewData.map(u => ({
                id: u.id,
                userId: u.user_id,
                email: u.user_email || '',
                fullName: u.user_full_name || '',
                approvalType: u.approval_type || 'training_partner',
                status: u.status || 'active',
                invitedAt: u.approved_at || u.created_at,
                approvedAt: u.approved_at,
                sessionsCompleted: 0,
                invitationSent: true  // They're already in the system
            }))
            setTrainingUsers(mapped)
            return
        }

        // Fallback: Query base table (won't have emails without the view)
        const { data, error } = await supabase
            .from('approved_training_users')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })

        if (error) {
            if (error.code === '42P01') { setTrainingUsers([]); return }
            throw error
        }

        const mapped: TrainingUser[] = (data || []).map(u => ({
            id: u.id,
            userId: u.user_id,
            email: u.user_id ? `User ${u.user_id.slice(0, 8)}...` : 'Unknown',
            fullName: u.notes || '',
            approvalType: u.approval_type || 'training_partner',
            status: u.status || 'active',
            invitedAt: u.approved_at || u.created_at,
            approvedAt: u.approved_at,
            sessionsCompleted: 0,
            invitationSent: true
        }))
        setTrainingUsers(mapped)
        
    } catch (error) {
        console.error('Error loading training users:', error)
        setTrainingUsers([])
    } finally {
        setTrainingLoading(false)
    }
}, [])

    const loadCompanyUsers = useCallback(async (companyId: string) => {
        setUsersLoading(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase.from('company_users').select('*').eq('company_id', companyId).neq('status', 'removed').order('created_at', { ascending: false })
            if (error) { if (error.code === '42P01') { setCompanyUsers([]); return }; throw error }
            setCompanyUsers((data || []).map(u => ({ id: u.id, userId: u.user_id, email: u.email, fullName: u.full_name || '', role: u.role || 'user', status: u.status || 'invited', invitedAt: u.invited_at || u.created_at, lastActiveAt: u.last_active_at })))
        } catch (e) { console.error('Load company users error:', e); setCompanyUsers([]) } finally { setUsersLoading(false) }
    }, [])

    // Playbook handlers
    const handlePlaybookUpload = async (file: File) => {
        let companyId = userInfo?.companyId; const supabase = createClient()
        if (!companyId) { const { data } = await supabase.from('companies').select('company_id').limit(1).single(); companyId = data?.company_id }
        if (!companyId) { const { data, error } = await supabase.from('companies').insert({ company_name: userInfo?.company || 'My Company' }).select('company_id').single(); if (error) throw new Error(error.message); companyId = data?.company_id }
        const fileName = `${companyId}/${Date.now()}.${file.name.split('.').pop()}`
        const { error: uploadError } = await supabase.storage.from('playbooks').upload(fileName, file)
        if (uploadError) throw new Error(uploadError.message)
        const { error: insertError } = await supabase.from('company_playbooks').insert({ company_id: companyId, playbook_name: file.name.replace(/\.[^/.]+$/, ''), source_file_name: file.name, source_file_path: fileName, status: 'pending_parse', created_by: userInfo?.userId })
        if (insertError) throw new Error(insertError.message)
        await loadPlaybooks(companyId!)
    }

    const handlePlaybookParse = async (playbookId: string) => {
        console.log('=== handlePlaybookParse ===', playbookId)
        const supabase = createClient()
        await supabase.from('company_playbooks').update({ status: 'parsing', parsing_started_at: new Date().toISOString() }).eq('playbook_id', playbookId)
        try {
            const response = await fetch(`${API_BASE}/parse-playbook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playbook_id: playbookId }) })
            console.log('Parse response:', response.status)
            const text = await response.text(); console.log('Response:', text)
            if (!response.ok) { await supabase.from('company_playbooks').update({ status: 'parse_failed', parsing_error: `HTTP ${response.status}` }).eq('playbook_id', playbookId); throw new Error(`HTTP ${response.status}`) }
        } catch (e) { console.error('Parse error:', e); throw e }
        setTimeout(() => { if (userInfo?.companyId) loadPlaybooks(userInfo.companyId) }, 2000)
    }

    const handlePlaybookActivate = async (playbookId: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        await supabase.from('company_playbooks').update({ is_active: false }).eq('company_id', userInfo.companyId).eq('is_active', true)
        await supabase.from('company_playbooks').update({ is_active: true, activated_at: new Date().toISOString(), status: 'active' }).eq('playbook_id', playbookId)
        await loadPlaybooks(userInfo.companyId)
    }

    const handlePlaybookDeactivate = async (playbookId: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        await supabase.from('company_playbooks').update({ is_active: false, status: 'inactive' }).eq('playbook_id', playbookId)
        await loadPlaybooks(userInfo.companyId)
    }

    const handlePlaybookDelete = async (playbookId: string, sourceFilePath?: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        await supabase.from('playbook_rules').delete().eq('playbook_id', playbookId)
        await supabase.from('company_playbooks').delete().eq('playbook_id', playbookId)
        if (sourceFilePath) await supabase.storage.from('playbooks').remove([sourceFilePath])
        await loadPlaybooks(userInfo.companyId)
    }

    const handlePlaybookDownload = async (sourceFilePath: string, fileName: string) => {
        const supabase = createClient()
        const { data, error } = await supabase.storage.from('playbooks').download(sourceFilePath)
        if (error) throw new Error(error.message)
        const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    }

    // Training handlers
    const handleAddTrainingUser = async (email: string, fullName: string, approvalType: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        const { error } = await supabase.from('approved_training_users').insert({ company_id: userInfo.companyId, user_email: email, user_full_name: fullName, approval_type: approvalType, status: 'active', approved_by_email: userInfo.email, approved_at: new Date().toISOString() })
        if (error) { if (error.code === '23505') throw new Error('User already exists'); throw new Error(error.message) }
        await handleSendTrainingInvite('', email); await loadTrainingUsers(userInfo.companyId)
    }

    const handleRemoveTrainingUser = async (id: string) => { if (!userInfo?.companyId) return; const supabase = createClient(); await supabase.from('approved_training_users').delete().eq('id', id); await loadTrainingUsers(userInfo.companyId) }

    const handleSendTrainingInvite = async (id: string, email: string) => {
        try { await fetch(`${API_BASE}/send-user-invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, company_name: companyName, inviter_name: `${userInfo?.firstName || ''} ${userInfo?.lastName || ''}`.trim() || userInfo?.email, inviter_email: userInfo?.email, invite_type: 'training' }) }) } catch (e) { console.log('Invite error:', e) }
        if (id && userInfo?.companyId) { const supabase = createClient(); await supabase.from('approved_training_users').update({ invitation_sent: true, invitation_sent_at: new Date().toISOString() }).eq('id', id); await loadTrainingUsers(userInfo.companyId) }
    }

    // Company user handlers
    const handleAddCompanyUser = async (email: string, fullName: string, role: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        const { error } = await supabase.from('company_users').insert({ company_id: userInfo.companyId, email, full_name: fullName, role, status: 'invited', invited_by: userInfo.userId, invited_at: new Date().toISOString() })
        if (error) { if (error.code === '23505') throw new Error('User already exists'); throw new Error(error.message) }
        await handleSendCompanyInvite('', email); await loadCompanyUsers(userInfo.companyId)
    }

    const handleRemoveCompanyUser = async (id: string) => { if (!userInfo?.companyId) return; const supabase = createClient(); await supabase.from('company_users').update({ status: 'removed' }).eq('id', id); await loadCompanyUsers(userInfo.companyId) }

    const handleSendCompanyInvite = async (id: string, email: string) => {
        try { await fetch(`${API_BASE}/send-user-invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, company_name: companyName, inviter_name: `${userInfo?.firstName || ''} ${userInfo?.lastName || ''}`.trim() || userInfo?.email, inviter_email: userInfo?.email, invite_type: 'platform' }) }) } catch (e) { console.log('Invite error:', e) }
        if (id && userInfo?.companyId) { const supabase = createClient(); await supabase.from('company_users').update({ invitation_sent: true, invitation_sent_at: new Date().toISOString() }).eq('id', id); await loadCompanyUsers(userInfo.companyId) }
    }

    useEffect(() => {
        const init = async () => {
            console.log('=== INIT COMPANY ADMIN ===')
            const user = await checkAuth(); if (!user) return
            setUserInfo(user); setCompanyName(user.company || 'Your Company')
            const hasAccess = await checkAdminAccess(user.email, user.companyId); setIsAdmin(hasAccess)
            if (!hasAccess) { router.push('/auth/contracts-dashboard'); return }
            if (user.companyId) { await Promise.all([loadPlaybooks(user.companyId), loadTrainingUsers(user.companyId), loadCompanyUsers(user.companyId)]) }
            setLoading(false)
        }
        init()
    }, [checkAuth, checkAdminAccess, loadPlaybooks, loadTrainingUsers, loadCompanyUsers, router])

    if (loading) return <CompanyAdminLoading />
    if (!isAdmin) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="text-center"><h2 className="text-xl font-semibold text-slate-800 mb-2">Access Denied</h2><button onClick={() => router.push('/auth/contracts-dashboard')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Go to Dashboard</button></div></div>

    const pendingCount = { training: trainingUsers.filter(u => u.status === 'pending').length, users: companyUsers.filter(u => u.status === 'invited').length }

    return (
        <div className="min-h-screen bg-slate-100">
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.push('/auth/contracts-dashboard')} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
                            <div><h1 className="text-xl font-bold text-slate-800">Company Admin</h1><p className="text-sm text-slate-500">{companyName}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right"><p className="text-sm font-medium text-slate-700">{userInfo?.firstName} {userInfo?.lastName}</p><p className="text-xs text-slate-500">{userInfo?.email}</p></div>
                            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center"><span className="text-white font-bold">{userInfo?.firstName?.[0] || 'A'}</span></div>
                        </div>
                    </div>
                </div>
            </header>
            <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} pendingCount={pendingCount} />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                    {activeTab === 'playbooks' && <PlaybooksTab playbooks={playbooks} isLoading={playbooksLoading} onUpload={handlePlaybookUpload} onActivate={handlePlaybookActivate} onDeactivate={handlePlaybookDeactivate} onParse={handlePlaybookParse} onDelete={handlePlaybookDelete} onDownload={handlePlaybookDownload} onRefresh={() => userInfo?.companyId && loadPlaybooks(userInfo.companyId)} />}
                    {activeTab === 'training' && <TrainingAccessTab users={trainingUsers} isLoading={trainingLoading} onAddUser={handleAddTrainingUser} onRemoveUser={handleRemoveTrainingUser} onSendInvite={handleSendTrainingInvite} onRefresh={() => userInfo?.companyId && loadTrainingUsers(userInfo.companyId)} />}
                    {activeTab === 'users' && <UsersTab users={companyUsers} isLoading={usersLoading} onAddUser={handleAddCompanyUser} onRemoveUser={handleRemoveCompanyUser} onSendInvite={handleSendCompanyInvite} onRefresh={() => userInfo?.companyId && loadCompanyUsers(userInfo.companyId)} />}
                    {activeTab === 'audit' && <AuditLogTab />}
                </div>
            </main>
        </div>
    )
}

// ============================================================================
// SECTION 10: PAGE EXPORT
// ============================================================================

export default function CompanyAdminPage() { return <Suspense fallback={<CompanyAdminLoading />}><CompanyAdminContent /></Suspense> }