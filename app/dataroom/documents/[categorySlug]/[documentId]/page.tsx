import { ArrowLeft, Download, FileText } from 'lucide-react'
import Link from 'next/link'
import DataroomAuthGuard from '../../../components/DataroomAuthGuard'

interface Props {
  params: Promise<{ categorySlug: string; documentId: string }>
}

export default async function DocumentViewer({ params }: Props) {
  const { categorySlug, documentId } = await params

  return (
    <DataroomAuthGuard>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <Link
          href={`/documents/${categorySlug}`}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {categorySlug.replace(/-/g, ' ')}
        </Link>

        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-2">Document</h1>
            <p className="text-slate-500 text-xs font-mono">{documentId}</p>
          </div>
          <button
            disabled
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>

        {/* Placeholder document viewer */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl min-h-[60vh] flex items-center justify-center">
          <div className="text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Document viewer — coming soon</p>
            <p className="text-xs text-slate-600 mt-1">
              Inline PDF rendering will be implemented here.
            </p>
          </div>
        </div>
      </div>
    </DataroomAuthGuard>
  )
}
