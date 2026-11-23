import Link from 'next/link'
import { FileQuestion, ArrowLeft } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#08090b] text-[#f3f4f6]">
      <Nav />
      <main className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-400">
          <FileQuestion size={28} />
        </div>

        <div className="mt-4 font-mono text-xs uppercase tracking-widest text-amber-400">
          404 — Not Found
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          Resource Unavailable
        </h1>
        <p className="mt-3 text-xs leading-relaxed text-[#9ca3af]">
          The requested repository analysis, assessment session, or workspace could not be located in the diagnostic records.
        </p>

        <div className="mt-7 flex justify-center">
          <Link href="/">
            <Button variant="primary" size="md" leftIcon={<ArrowLeft size={14} />}>
              Return to Repository Overview
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
