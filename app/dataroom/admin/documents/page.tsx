import { Upload, FileText } from 'lucide-react'

export default function AdminDocuments() {
  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">Documents</h1>
          <p className="text-slate-400 text-sm">
            Upload, categorise, and manage data room documents.
          </p>
        </div>
        <button
          disabled
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {/* Document table placeholder */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-6 py-3 bg-slate-800/50 text-slate-400 text-xs font-medium uppercase tracking-wider">
          <span>Title</span>
          <span>Category</span>
          <span>Visibility</span>
          <span>Version</span>
          <span>Uploaded</span>
        </div>
        <div className="p-6 flex items-center gap-4 text-slate-500">
          <FileText className="w-5 h-5" />
          <span className="text-sm">No documents uploaded yet.</span>
        </div>
      </div>
    </div>
  )
}
