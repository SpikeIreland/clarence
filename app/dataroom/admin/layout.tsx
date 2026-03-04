import DataroomSidebar from '../components/DataroomSidebar'
import DataroomAuthGuard from '../components/DataroomAuthGuard'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DataroomAuthGuard requiredRole="admin">
      <div className="flex flex-1">
        <DataroomSidebar />
        <div className="flex-1 p-8">{children}</div>
      </div>
    </DataroomAuthGuard>
  )
}
