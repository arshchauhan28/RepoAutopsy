import Link from 'next/link'
import { CodePulseLogo } from './CodePulseLogo'

export function Brand() {
  return (
    <Link href="/" className="group flex min-w-0 items-center gap-2.5 select-none">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-amber-500/25 bg-[#08090b] text-[#EAB308] shadow-[0_0_12px_rgba(234,179,8,0.08)] transition duration-200 group-hover:border-amber-400/50 group-hover:bg-[#111318] group-hover:shadow-[0_0_16px_rgba(234,179,8,0.18)]">
        <CodePulseLogo size={20} strokeColor="#EAB308" className="transition duration-200 group-hover:brightness-110" />
      </span>
      <span className="truncate font-mono text-[13px] font-bold tracking-[.09em] text-[#F4F4F5] transition duration-150 group-hover:text-white sm:text-[13.5px]">
        REPOAUTOPSY
      </span>
    </Link>
  )
}
