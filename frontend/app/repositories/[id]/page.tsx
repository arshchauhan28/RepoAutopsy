'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Bot, FileCode2, GitBranch, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { ArchitectureMap } from '@/components/ArchitectureMap'
import { FindingList } from '@/components/FindingList'
import { MetricCard } from '@/components/MetricCard'
import { StatusPill } from '@/components/StatusPill'
import { getAnalysis, type Analysis } from '@/lib/api'

export default function RepositoryPage() {
  const params=useParams<{id:string}>(); const [analysis,setAnalysis]=useState<Analysis|null>(null); const [error,setError]=useState('')
  async function load(){try{setAnalysis(await getAnalysis(params.id));setError('')}catch(e:any){setError(e?.message||'Unable to load repository')}}
  useEffect(()=>{load()},[params.id])
  useEffect(()=>{if(!analysis||!['queued','running'].includes(analysis.status))return;const timer=setInterval(load,2500);return()=>clearInterval(timer)},[analysis?.status,params.id])
  const metrics=analysis?.metrics||{}; const findings=analysis?.findings||[]; const security=findings.filter(f=>f.category==='security').length; const quality=findings.filter(f=>f.category==='quality').length
  const languages=useMemo(()=>Object.entries(analysis?.languages||{}).slice(0,6),[analysis])

  if(error)return <div className="min-h-screen"><Nav/><main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20"><div className="card border-rose-400/20 bg-rose-400/[.04] p-6 text-sm text-rose-300 reveal">{error}</div></main></div>
  if(!analysis)return <div className="min-h-screen"><Nav/><main className="mx-auto max-w-5xl px-4 py-16 text-sm text-[#77736c] sm:px-6 sm:py-20">Loading repository…</main></div>

  return <div className="min-h-screen"><Nav/><main className="mx-auto max-w-7xl px-4 py-7 pb-16 sm:px-6 sm:py-9 lg:px-8 lg:pb-20">
    <div className="reveal flex flex-col gap-4 border-b border-white/[.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2.5"><h1 className="break-all text-2xl font-semibold tracking-tight sm:text-3xl">{analysis.owner}/{analysis.repo_name}</h1><StatusPill status={analysis.status}/></div><a className="mt-2 block max-w-full truncate font-mono text-[11px] text-amber-300/80 transition hover:text-amber-300" href={analysis.github_url} target="_blank" rel="noreferrer">{analysis.github_url}</a></div>
      <button onClick={load} className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 border border-white/[.1] px-4 py-2 text-sm text-[#aaa69e] transition hover:bg-white/[.04] sm:w-auto"><RefreshCw size={15}/>Refresh</button>
    </div>

    {(analysis.status==='queued'||analysis.status==='running')&&<div className="card relative mt-6 overflow-hidden reveal"><div className="h-1 overflow-hidden bg-white/[.04]"><div className="h-full w-1/2 animate-[progressSweep_2.2s_ease-in-out_infinite] bg-amber-400"/></div><div className="scan-overlay opacity-50"/><div className="relative p-5 sm:p-7"><div className="flex items-center gap-3"><div className="h-2 w-2 animate-glow rounded-full bg-amber-400"/><h2 className="font-medium">{analysis.status==='queued'?'Analysis queued':'Analyzing repository'}</h2></div><p className="mt-2 max-w-2xl text-sm leading-6 text-[#77736c]">RepoAutopsy is fetching the repository and building static evidence. This page refreshes automatically.</p><div className="mt-5 grid gap-2 sm:grid-cols-3">{['Repository fetched','Code structure parsed','AI insights prepared'].map((x,i)=><div key={x} className="border border-white/[.07] bg-white/[.02] p-3 text-xs text-[#77736c]"><span className="mr-2 font-mono text-amber-400">0{i+1}</span>{x}</div>)}</div></div></div>}

    {analysis.status==='failed'&&<div className="mt-6 border border-rose-400/20 bg-rose-400/[.04] p-4 text-sm leading-6 text-rose-300 reveal">{analysis.error||'The analysis failed.'}</div>}

    {analysis.status==='completed'&&<>
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">{[
        ['Files',metrics.total_files||0],['Code lines',(metrics.code_lines||0).toLocaleString()],['Functions',metrics.functions||0],['Security',security],['Quality',quality]
      ].map(([label,value],i)=><div key={label as string} className={`reveal reveal-delay-${Math.min(i+1,4)}`}><MetricCard label={label as string} value={value as string|number} detail={label==='Security'||label==='Quality'?'detected findings':undefined}/></div>)}</div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[1.35fr_.65fr]">
        <div className="space-y-8">
          <section className="reveal"><div className="mb-3 flex items-end justify-between gap-4"><div><div className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-400">/ system map</div><h2 className="mt-1 text-xl font-semibold">Architecture</h2><p className="mt-1 text-sm text-[#66625b]">Derived from repository structure and detected imports.</p></div><GitBranch className="hidden text-[#8b867d] sm:block" size={19}/></div><ArchitectureMap architecture={analysis.architecture}/></section>
          <section className="reveal"><div className="mb-3 flex items-end justify-between gap-4"><div><div className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-400">/ diagnostics</div><h2 className="mt-1 text-xl font-semibold">Codebase Doctor</h2><p className="mt-1 text-sm text-[#66625b]">Static findings to investigate before production.</p></div><ShieldAlert className="hidden text-amber-300 sm:block" size={19}/></div><FindingList findings={findings}/></section>
        </div>

        <aside className="space-y-5">
          <div className="card interactive-card p-5 reveal reveal-delay-2"><div className="flex items-center gap-2"><Sparkles size={16} className="text-amber-300"/><h2 className="font-medium">AI review</h2></div><p className="mt-4 text-sm leading-6 text-[#8a867f]">{analysis.summary}</p><div className="mt-5 space-y-2.5">{(analysis.ai_insights?.priorities||[]).slice(0,4).map((x: string, i: number)=><div key={x} className="border border-white/[.06] bg-white/[.02] p-3 text-xs leading-5 text-[#8a867f]"><span className="mr-2 font-mono text-amber-400">0{i+1}</span>{x}</div>)}</div></div>
          <div className="card interactive-card p-5 reveal reveal-delay-3"><div className="flex items-center gap-2"><FileCode2 size={16} className="text-[#aaa69e]"/><h2 className="font-medium">Languages</h2></div><div className="mt-5 space-y-4">{languages.map(([name,count])=><div key={name}><div className="flex justify-between gap-3 text-xs"><span className="truncate text-[#c8c4bc]">{name}</span><span className="shrink-0 text-[#66625b]">{count as number} files</span></div><div className="mt-1.5 h-1 overflow-hidden bg-white/[.05]"><div className="h-full bg-amber-400 transition-all duration-700" style={{width:`${Math.max(6,((count as number)/(metrics.total_files||1))*100)}%`}}/></div></div>)}</div></div>
          <div className="card interactive-card p-5 reveal reveal-delay-4"><Bot size={18} className="text-emerald-300"/><h2 className="mt-3 font-medium">Ready for the interview?</h2><p className="mt-1 text-sm leading-6 text-[#77736c]">Answer questions generated from this repository, then review where your explanation needs more depth.</p><Link href={`/repositories/${analysis.id}/interview`} className="group mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-amber-400/40 bg-amber-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-300">Start interview <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5"/></Link></div>
        </aside>
      </div>
    </>}
  </main></div>
}
