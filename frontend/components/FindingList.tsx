import { AlertTriangle, ShieldAlert, Info, CheckCircle2 } from 'lucide-react'
import type { Finding } from '@/lib/api'

export function FindingList({ findings }: { findings: Finding[] }) {
  if (!findings.length) return <div className="card p-8 text-center text-slate-400">No findings were detected by the current static checks.</div>
  return <div className="space-y-3">
    {findings.map(f => {
      const Icon = f.category === 'security' ? ShieldAlert : f.severity === 'low' ? Info : AlertTriangle
      return <div key={f.id} className="card p-4">
        <div className="flex gap-3">
          <div className="mt-0.5 text-amber-300"><Icon size={18}/></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-white">{f.title}</h3><span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase text-slate-400">{f.severity}</span></div>
            <p className="mt-1 text-sm leading-6 text-slate-400">{f.description}</p>
            {f.file_path && <div className="mt-2 font-mono text-xs text-violet-300">{f.file_path}{f.line ? `:${f.line}` : ''}</div>}
            {f.recommendation && <div className="mt-3 flex gap-2 rounded-xl bg-white/[.03] p-3 text-xs leading-5 text-slate-300"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-300"/>{f.recommendation}</div>}
          </div>
        </div>
      </div>
    })}
  </div>
}
