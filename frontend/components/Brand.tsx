import Link from 'next/link'
import { ScanSearch } from 'lucide-react'

export function Brand() {
  return <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-white shadow-lg shadow-violet-500/20"><ScanSearch size={18}/></span>
    <span>RepoAutopsy</span>
  </Link>
}
