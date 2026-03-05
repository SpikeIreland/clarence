'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Download, FileText, Loader2, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import DataroomAuthGuard from '../../../components/DataroomAuthGuard'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface DocumentMeta {
  document_id: string
  title: string
  description: string | null
  file_name: string
  file_type: string
  file_size_bytes: number | null
  version: number
  created_at: string
  category: { name: string; slug: string } | null
}

export default function DocumentViewer() {
  const params = useParams()
  const categorySlug = params.categorySlug as string
  const documentId = params.documentId as string

  const [doc, setDoc] = useState<DocumentMeta | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        // Fetch document metadata
        const docsRes = await fetch('/api/dataroom/documents')
        const docsData = await docsRes.json()
        const found = docsData.documents?.find(
          (d: DocumentMeta) => d.document_id === documentId
        )

        if (!found) {
          setError('Document not found')
          setLoading(false)
          return
        }

        setDoc(found)

        // Fetch signed URL
        const urlRes = await fetch(`/api/dataroom/documents/${documentId}/signed-url`)
        const urlData = await urlRes.json()

        if (urlData.url) {
          setSignedUrl(urlData.url)
        } else {
          setError('Failed to load document')
        }
      } catch (err) {
        console.error('Error loading document:', err)
        setError('Failed to load document')
      }
      setLoading(false)
    }

    load()
  }, [documentId])

  async function handleDownload() {
    if (!signedUrl || !doc) return
    setDownloading(true)

    try {
      const res = await fetch(signedUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = doc.file_name
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
    setDownloading(false)
  }

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

  const isPdf = doc?.file_type.includes('pdf')
  const isImage = doc?.file_type.startsWith('image/')
  const categoryName = doc?.category?.name || categorySlug.replace(/-/g, ' ')

  return (
    <DataroomAuthGuard>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <Link
          href={`/documents/${categorySlug}`}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {categoryName}
        </Link>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading document...
          </div>
        ) : error ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">{error}</p>
          </div>
        ) : doc ? (
          <>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-white mb-1">{doc.title}</h1>
                {doc.description && (
                  <p className="text-slate-400 text-sm mb-2">{doc.description}</p>
                )}
                <div className="flex items-center gap-4 text-slate-500 text-xs">
                  <span>{formatDate(doc.created_at)}</span>
                  {doc.file_size_bytes && <span>{formatFileSize(doc.file_size_bytes)}</span>}
                  {doc.version > 1 && <span>v{doc.version}</span>}
                  <span className="font-mono">{doc.file_name}</span>
                </div>
              </div>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download
              </button>
            </div>

            {/* Document viewer */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {isPdf && signedUrl ? (
                <div className="p-4">
                  <Document
                    file={signedUrl}
                    onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                    loading={
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                      </div>
                    }
                    error={
                      <div className="text-center py-20 text-slate-500 text-sm">
                        Failed to load PDF. Try downloading instead.
                      </div>
                    }
                    className="flex flex-col items-center gap-4"
                  >
                    {numPages &&
                      Array.from({ length: numPages }, (_, i) => (
                        <Page
                          key={i + 1}
                          pageNumber={i + 1}
                          width={Math.min(800, typeof window !== 'undefined' ? window.innerWidth - 120 : 800)}
                          className="shadow-lg"
                        />
                      ))}
                  </Document>
                  {numPages && (
                    <p className="text-center text-slate-600 text-xs mt-4">
                      {numPages} page{numPages !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              ) : isImage && signedUrl ? (
                <div className="p-4 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signedUrl}
                    alt={doc.title}
                    className="max-w-full max-h-[80vh] rounded-lg"
                  />
                </div>
              ) : (
                <div className="p-12 text-center">
                  {isImage ? (
                    <ImageIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  ) : (
                    <FileText className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  )}
                  <p className="text-slate-400 text-sm mb-1">
                    Preview not available for this file type
                  </p>
                  <p className="text-slate-600 text-xs">
                    Click Download to view {doc.file_name}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </DataroomAuthGuard>
  )
}
