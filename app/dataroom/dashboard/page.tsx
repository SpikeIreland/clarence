import { FolderOpen } from 'lucide-react'
import DataroomAuthGuard from '../components/DataroomAuthGuard'

export default function DataroomDashboard() {
  return (
    <DataroomAuthGuard>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white mb-2">Data Room</h1>
          <p className="text-slate-400 text-sm">
            Browse available document categories below.
          </p>
        </div>

        {/* Placeholder category grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {['Investment Materials', 'Technical Documentation', 'Legal & Corporate'].map(
            (category) => (
              <div
                key={category}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors"
              >
                <FolderOpen className="w-6 h-6 text-emerald-500 mb-3" />
                <h3 className="text-white font-medium mb-1">{category}</h3>
                <p className="text-slate-500 text-sm">0 documents</p>
              </div>
            )
          )}
        </div>
      </div>
    </DataroomAuthGuard>
  )
}
