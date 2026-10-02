import { AlertTriangle, ShieldAlert, Info, CheckCircle2 } from 'lucide-react'
import type { Finding } from '@/lib/api'

export function FindingList({ findings }: { findings: Finding[] }) {
  if (!findings.length) return <div className="card p-7 text-center text-sm text-[#77736c]">No findings were detected by the current static checks.</div>
  return (
    <div className="space-y-2.5">
      {findings.map((f, i) => {
        const Icon = f.category === 'security' ? ShieldAlert : f.severity === 'low' ? Info : AlertTriangle
        return (
          <div key={f.id} className="card interactive-card p-4 reveal" style={{ animationDelay: `${Math.min(i, 7) * 45}ms` }}>
            <div className="flex gap-3">
              <div className="mt-0.5 shrink-0 text-amber-300"><Icon size={17}/></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-white">{f.title}</h3>
                  <span className="border border-white/[.08] bg-white/[.03] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#77736c]">{f.severity}</span>
                </div>
                <p className="mt-1.5 text-sm leading-6 text-[#8a867f]">{f.description}</p>
                {f.file_path && <div className="mt-2 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-amber-300/80">{f.file_path}{f.line ? `:${f.line}` : ''}</div>}
                {f.recommendation && <div className="mt-3 flex gap-2 border border-white/[.06] bg-white/[.025] p-3 text-xs leading-5 text-[#aaa69e]"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-300"/>{f.recommendation}</div>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
