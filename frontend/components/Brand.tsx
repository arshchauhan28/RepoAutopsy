import Link from 'next/link'
import { CodePulseLogo } from './CodePulseLogo'

export function Brand() {
  return (
    <Link href="/" className="group flex min-w-0 items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/[.12] bg-[#0c0d10] transition duration-200 group-hover:border-amber-400/40 group-hover:bg-[#12141a]">
        <CodePulseLogo size={20} className="transition duration-200 group-hover:brightness-110" />
      </span>
      <span className="truncate font-mono text-[12px] font-semibold tracking-[.08em] text-[#e8e6e1] sm:text-[13px]">
        REPOAUTOPSY
      </span>
    </Link>
  )
}
