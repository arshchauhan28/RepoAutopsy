export function StatusPill({ status }: { status: string }) {
  const styles: Record<string,string> = {
    queued: 'border-amber-400/20 bg-amber-400/[.07] text-amber-300',
    running: 'border-cyan-400/20 bg-cyan-400/[.07] text-cyan-300',
    completed: 'border-emerald-400/20 bg-emerald-400/[.07] text-emerald-300',
    failed: 'border-rose-400/20 bg-rose-400/[.07] text-rose-300',
  }
  return <span className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase tracking-[.12em] ${styles[status] || 'border-white/10 bg-white/5 text-slate-300'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>
}
