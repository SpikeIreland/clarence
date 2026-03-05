'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Upload, File } from 'lucide-react'
import type { CategorySectionGroup } from '@/lib/dataroom/types'

interface UploadDocumentModalProps {
  onClose: () => void
  onSuccess: () => void
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
  'image/png',
  'image/jpeg',
  'image/webp',
]

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.xlsx,.pptx,.mp4,.png,.jpg,.jpeg,.webp'

export default function UploadDocumentModal({ onClose, onSuccess }: UploadDocumentModalProps) {
  const [mounted, setMounted] = useState(false)
  const [sections, setSections] = useState<CategorySectionGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const overlayRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [visibility, setVisibility] = useState<'investor' | 'internal'>('investor')

  useEffect(() => {
    setMounted(true)
    fetchCategories()
  }, [])

  async function fetchCategories() {
    const res = await fetch('/api/dataroom/categories')
    const data = await res.json()
    if (data.sections) {
      setSections(data.sections)
    }
  }

  function handleFileSelect(selectedFile: File | null) {
    if (!selectedFile) return

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit.')
      return
    }

    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setError('Unsupported file type. Please upload PDF, DOCX, XLSX, PPTX, MP4, or image files.')
      return
    }

    setFile(selectedFile)
    setError('')
    if (!title) {
      // Auto-populate title from filename (without extension)
      const name = selectedFile.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
      setTitle(name)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) handleFileSelect(droppedFile)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!file || !title || !categoryId) {
      setError('Please select a file, enter a title, and choose a category.')
      return
    }

    setLoading(true)
    setUploadProgress(10)

    try {
      const { createClient } = await import('@/lib/dataroom/supabase')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('You must be signed in.')
        setLoading(false)
        return
      }

      setUploadProgress(30)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title)
      formData.append('description', description)
      formData.append('category_id', categoryId)
      formData.append('visibility', visibility)

      const res = await fetch('/api/dataroom/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      setUploadProgress(90)

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to upload document.')
        setLoading(false)
        setUploadProgress(0)
        return
      }

      setUploadProgress(100)
      onSuccess()
      onClose()
    } catch {
      setError('An unexpected error occurred.')
      setLoading(false)
      setUploadProgress(0)
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (!mounted) return null

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[99999] p-4"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold text-lg">Upload Document</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-900/30 text-red-400 border border-red-800 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* File drop zone */}
          <div>
            <label className="block text-slate-400 text-sm mb-1.5">
              File <span className="text-red-400">*</span>
            </label>
            {file ? (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center gap-3">
                <File className="w-8 h-8 text-emerald-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm truncate">{file.name}</p>
                  <p className="text-slate-500 text-xs">{formatFileSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setFile(null); setTitle('') }}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-500/50 transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">
                  Drop a file here or click to browse
                </p>
                <p className="text-slate-600 text-xs mt-1">
                  PDF, DOCX, XLSX, PPTX, MP4, or images — max 50MB
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              className="hidden"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-slate-400 text-sm mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g., Pitch Deck v3"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-400 text-sm mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional — brief description of the document"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Category — grouped by section */}
          <div>
            <label className="block text-slate-400 text-sm mb-1.5">
              Category <span className="text-red-400">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Select a category</option>
              {sections.map((section) => (
                <optgroup key={section.section} label={section.label}>
                  {section.categories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-slate-400 text-sm mb-1.5">
              Visibility
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVisibility('investor')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  visibility === 'investor'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Investor
              </button>
              <button
                type="button"
                onClick={() => setVisibility('internal')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  visibility === 'internal'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Internal Only
              </button>
            </div>
          </div>

          {/* Upload progress */}
          {loading && uploadProgress > 0 && (
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-800 text-slate-300 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Upload'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
