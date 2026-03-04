import type { Metadata } from 'next'
import DataroomHeader from './components/DataroomHeader'
import DataroomFooter from './components/DataroomFooter'

export const metadata: Metadata = {
  title: {
    default: 'Data Room | CLARENCE',
    template: '%s | Data Room | CLARENCE',
  },
  description: 'Clarence Legal Investment Data Room — secure document repository and investor access portal.',
}

export default function DataroomLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <DataroomHeader />
      <main className="flex-1">{children}</main>
      <DataroomFooter />
    </div>
  )
}
