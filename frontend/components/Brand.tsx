import Link from 'next/link'
import { ScanSearch } from 'lucide-react'

export function Brand() {
  return (
    <Link href="/" className="group flex min-w-0 items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center border border-white/[.12] bg-[#111418] text-amber-400 transition duration-200 group-hover:border-amber-400/30 group-hover:bg-[#15181d]">
        <ScanSearch size={16} />
      </span>
      <span className="truncate font-mono text-[12px] font-semibold tracking-[.08em] text-[#e8e6e1] sm:text-[13px]">
        REPOAUTOPSY
      </span>
    </Link>
  )
}
