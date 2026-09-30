export function StatusPill({ status }: { status: string }) {
  const styles: Record<string,string> = {
    queued: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    running: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300',
    completed: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    failed: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  }
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status] || 'border-white/10 bg-white/5 text-slate-300'}`}>{status}</span>
}
