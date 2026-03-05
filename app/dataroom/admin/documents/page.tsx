'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, FileText, Trash2, RefreshCw, Eye, Lock } from 'lucide-react'
import UploadDocumentModal from '../../components/UploadDocumentModal'

interface Document {
  document_id: string
  category_id: string
  title: string
  description: string | null
  file_name: string
  file_type: string
  file_size_bytes: number | null
  version: number
  visibility: 'internal' | 'investor'
  created_at: string
  category: { name: string; slug: string } | null
}

export default function AdminDocuments() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [filterVisibility, setFilterVisibility] = useState<'' | 'internal' | 'investor'>('')

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dataroom/documents')
      const data = await res.json()
      if (data.documents) {
        setDocuments(data.documents)
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  async function handleDelete(documentId: string) {
    if (!confirm('Are you sure you want to delete this document? This cannot be undone.')) return

    setDeleting(documentId)
    try {
      const res = await fetch('/api/dataroom/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId }),
      })

      if (res.ok) {
        fetchDocuments()
      }
    } catch (err) {
      console.error('Failed to delete document:', err)
    }
    setDeleting(null)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function getFileTypeLabel(mimeType: string) {
    if (mimeType.includes('pdf')) return 'PDF'
    if (mimeType.includes('wordprocessing')) return 'DOCX'
    if (mimeType.includes('spreadsheet')) return 'XLSX'
    if (mimeType.includes('presentation')) return 'PPTX'
    if (mimeType.includes('mp4')) return 'MP4'
    if (mimeType.startsWith('image/')) return 'IMG'
    return 'FILE'
  }

  const filteredDocuments = filterVisibility
    ? documents.filter((d) => d.visibility === filterVisibility)
    : documents

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">Documents</h1>
          <p className="text-slate-400 text-sm">
            Upload, categorise, and manage data room documents.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDocuments}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterVisibility}
          onChange={(e) => setFilterVisibility(e.target.value as '' | 'internal' | 'investor')}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
        >
          <option value="">All visibility</option>
          <option value="investor">Investor</option>
          <option value="internal">Internal</option>
        </select>
        <span className="text-slate-500 text-sm self-center">
          {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Document table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_auto_auto_1fr_auto] gap-4 px-6 py-3 bg-slate-800/50 text-slate-400 text-xs font-medium uppercase tracking-wider">
          <span>Title</span>
          <span>Category</span>
          <span>Type</span>
          <span>Visibility</span>
          <span>Uploaded</span>
          <span className="w-8" />
        </div>

        {loading ? (
          <div className="p-6 text-center text-slate-500 text-sm">
            Loading documents...
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-6 flex items-center gap-4 text-slate-500">
            <FileText className="w-5 h-5" />
            <span className="text-sm">
              {filterVisibility ? 'No documents match this filter.' : 'No documents uploaded yet.'}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.document_id}
                className="grid grid-cols-[2fr_1fr_auto_auto_1fr_auto] gap-4 px-6 py-3 items-center hover:bg-slate-800/30 transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-white text-sm truncate block">{doc.title}</span>
                  {doc.description && (
                    <span className="text-slate-500 text-xs truncate block">{doc.description}</span>
                  )}
                </div>
                <span className="text-slate-400 text-sm truncate">
                  {doc.category?.name || 'Unknown'}
                </span>
                <span className="text-slate-500 text-xs bg-slate-800 px-2 py-0.5 rounded font-mono">
                  {getFileTypeLabel(doc.file_type)}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                  doc.visibility === 'investor'
                    ? 'text-emerald-400 bg-emerald-900/30'
                    : 'text-amber-400 bg-amber-900/30'
                }`}>
                  {doc.visibility === 'investor' ? (
                    <Eye className="w-3 h-3" />
                  ) : (
                    <Lock className="w-3 h-3" />
                  )}
                  {doc.visibility}
                </span>
                <div className="text-sm">
                  <span className="text-slate-300">{formatDate(doc.created_at)}</span>
                  <span className="text-slate-600 text-xs block">{formatFileSize(doc.file_size_bytes)}</span>
                </div>
                <button
                  onClick={() => handleDelete(doc.document_id)}
                  disabled={deleting === doc.document_id}
                  className="text-slate-600 hover:text-red-400 transition-colors disabled:opacity-50 w-8 flex justify-center"
                  title="Delete document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      {showModal && (
        <UploadDocumentModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchDocuments}
        />
      )}
    </div>
  )
}
