import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import DataroomAuthGuard from '../../components/DataroomAuthGuard'

interface Props {
  params: Promise<{ categorySlug: string }>
}

export default async function CategoryDocuments({ params }: Props) {
  const { categorySlug } = await params

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
          <h1 className="text-2xl font-semibold text-white mb-2 capitalize">
            {categorySlug.replace(/-/g, ' ')}
          </h1>
          <p className="text-slate-400 text-sm">
            Documents in this category will appear here.
          </p>
        </div>

        {/* Placeholder document list */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
          <div className="p-6 flex items-center gap-4 text-slate-500">
            <FileText className="w-5 h-5" />
            <span className="text-sm">No documents uploaded yet.</span>
          </div>
        </div>
      </div>
    </DataroomAuthGuard>
  )
}
