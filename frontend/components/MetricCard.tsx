export function MetricCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="card p-5">
    <div className="text-xs uppercase tracking-[.14em] text-slate-500">{label}</div>
    <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
    {detail && <div className="mt-1 text-xs text-slate-500">{detail}</div>}
  </div>
}
