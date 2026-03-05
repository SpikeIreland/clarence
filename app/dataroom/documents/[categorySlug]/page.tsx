'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, FileText, Download } from 'lucide-react'
import Link from 'next/link'
import DataroomAuthGuard from '../../components/DataroomAuthGuard'

interface Document {
  document_id: string
  title: string
  description: string | null
  file_name: string
  file_type: string
  file_size_bytes: number | null
  version: number
  created_at: string
  category: { name: string; slug: string; section: string; min_tier: string } | null
}

export default function CategoryDocuments() {
  const params = useParams()
  const categorySlug = params.categorySlug as string
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryName, setCategoryName] = useState('')

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const res = await fetch(`/api/dataroom/documents?category_slug=${categorySlug}&visibility=investor`)
        const data = await res.json()
        if (data.documents) {
          setDocuments(data.documents)
          if (data.documents.length > 0 && data.documents[0].category) {
            setCategoryName(data.documents[0].category.name)
          }
        }
      } catch (err) {
        console.error('Failed to fetch documents:', err)
      }
      setLoading(false)
    }

    // Also fetch category name
    async function fetchCategory() {
      try {
        const res = await fetch('/api/dataroom/categories?role=investor')
        const data = await res.json()
        if (data.categories) {
          const cat = data.categories.find((c: { slug: string }) => c.slug === categorySlug)
          if (cat) setCategoryName(cat.name)
        }
      } catch {
        // Ignore — we'll use slug as fallback
      }
    }

    fetchDocuments()
    fetchCategory()
  }, [categorySlug])

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function getFileIcon(mimeType: string) {
    if (mimeType.includes('pdf')) return 'PDF'
    if (mimeType.includes('wordprocessing')) return 'DOCX'
    if (mimeType.includes('spreadsheet')) return 'XLSX'
    if (mimeType.includes('presentation')) return 'PPTX'
    if (mimeType.includes('mp4')) return 'MP4'
    if (mimeType.startsWith('image/')) return 'IMG'
    return 'FILE'
  }

  const displayName = categoryName || categorySlug.replace(/-/g, ' ')

  return (
    <DataroomAuthGuard>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to categories
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white mb-2">
            {displayName}
          </h1>
          <p className="text-slate-400 text-sm">
            {documents.length} document{documents.length !== 1 ? 's' : ''} available
          </p>
        </div>

        {loading ? (
          <div className="text-slate-500 text-sm">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No documents in this category yet.</p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
            {documents.map((doc) => (
              <Link
                key={doc.document_id}
                href={`/documents/${categorySlug}/${doc.document_id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/30 transition-colors group"
              >
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-mono text-slate-400">
                    {getFileIcon(doc.file_type)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-sm font-medium truncate group-hover:text-emerald-400 transition-colors">
                    {doc.title}
                  </h3>
                  {doc.description && (
                    <p className="text-slate-500 text-xs truncate mt-0.5">{doc.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-slate-600 text-xs">{formatDate(doc.created_at)}</span>
                    {doc.file_size_bytes && (
                      <span className="text-slate-600 text-xs">{formatFileSize(doc.file_size_bytes)}</span>
                    )}
                    {doc.version > 1 && (
                      <span className="text-slate-600 text-xs">v{doc.version}</span>
                    )}
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-700 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </DataroomAuthGuard>
  )
}
