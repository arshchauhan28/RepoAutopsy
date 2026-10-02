export function MetricCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="card interactive-card p-4 sm:p-5">
      <div className="font-mono text-[9px] uppercase tracking-[.16em] text-[#66625b] sm:text-[10px]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-[#e8e6e1] sm:text-3xl">{value}</div>
      {detail && <div className="mt-1 text-[11px] text-[#706c65]">{detail}</div>}
    </div>
  )
}
