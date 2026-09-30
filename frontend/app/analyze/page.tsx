'use client'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Github, Loader2, ShieldCheck } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { createAnalysis } from '@/lib/api'

export default function AnalyzePage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try { const result = await createAnalysis(url.trim()); router.push(`/repositories/${result.id}`) }
    catch (err: any) { setError(err.message || 'Unable to start analysis') }
    finally { setLoading(false) }
  }
  return <div className="min-h-screen"><Nav/><main className="mx-auto flex max-w-3xl px-5 py-20"><div className="w-full">
    <div className="text-xs uppercase tracking-[.16em] text-violet-300">New analysis</div><h1 className="mt-3 text-4xl font-semibold tracking-tight">Bring a repository.</h1><p className="mt-3 text-slate-400">RepoAutopsy will fetch the public GitHub repository, inspect its structure and prepare a technical review.</p>
    <form onSubmit={submit} className="card mt-10 p-6 sm:p-8"><label className="text-sm font-medium text-slate-200">GitHub repository URL</label><div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 focus-within:border-violet-400/50"><Github size={18} className="text-slate-500"/><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://github.com/owner/repository" className="min-w-0 flex-1 bg-transparent py-4 text-sm text-white outline-none placeholder:text-slate-600" required/></div>{error && <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-300">{error}</div>}<button disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60">{loading ? <Loader2 size={17} className="animate-spin"/> : <ArrowRight size={17}/>} {loading ? 'Starting analysis…' : 'Analyze repository'}</button><div className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400"/>Only GitHub repository URLs are accepted. The analyzer applies file-count, size and path-safety limits before processing.</div></form>
  </div></main></div>
}
