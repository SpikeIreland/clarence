export default function DataroomFooter() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 py-8">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-slate-500 text-sm">
          Clarence Legal Limited · Company No. 16983899
        </p>
        <p className="text-slate-600 text-xs">
          &copy; {new Date().getFullYear()} CLARENCE · The Honest Broker
        </p>
      </div>
    </footer>
  )
}
