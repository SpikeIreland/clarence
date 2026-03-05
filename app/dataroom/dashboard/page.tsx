'use client'

import { useState, useEffect } from 'react'
import { FolderOpen, FileText, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import DataroomAuthGuard from '../components/DataroomAuthGuard'
import type { CategorySectionGroup } from '@/lib/dataroom/types'

export default function DataroomDashboard() {
  const [sections, setSections] = useState<CategorySectionGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/dataroom/categories?role=investor')
        const data = await res.json()
        if (data.sections) {
          // Filter out sections where all categories have 0 investor-visible documents
          setSections(data.sections)
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err)
      }
      setLoading(false)
    }
    fetchCategories()
  }, [])

  return (
    <DataroomAuthGuard>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-white mb-2">Data Room</h1>
          <p className="text-slate-400 text-sm">
            Browse available document categories below. Documents are organised by section for easy navigation.
          </p>
        </div>

        {loading ? (
          <div className="text-slate-500 text-sm">Loading categories...</div>
        ) : sections.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No documents available yet.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {sections.map((section) => (
              <div key={section.section}>
                <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">
                  {section.label}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {section.categories.map((cat) => (
                    <Link
                      key={cat.category_id}
                      href={`/documents/${cat.slug}`}
                      className="group bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-emerald-500/30 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <FolderOpen className="w-5 h-5 text-emerald-500 mt-0.5" />
                        <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-emerald-500 transition-colors" />
                      </div>
                      <h3 className="text-white font-medium mt-3 mb-1">{cat.name}</h3>
                      {cat.description && (
                        <p className="text-slate-500 text-xs mb-2 line-clamp-2">{cat.description}</p>
                      )}
                      <p className="text-slate-600 text-xs">
                        {cat.document_count || 0} document{cat.document_count !== 1 ? 's' : ''}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DataroomAuthGuard>
  )
}
