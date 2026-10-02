'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Download, FileText, ShieldAlert } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { getReport } from '@/lib/api'

export default function ReportPage(){
  const params=useParams<{id:string}>(); const [report,setReport]=useState<any>(null); const [error,setError]=useState('')
  useEffect(()=>{getReport(params.id).then(setReport).catch(e=>setError(e.message))},[params.id])
  if(error)return <div className="min-h-screen"><Nav/><main className="mx-auto max-w-4xl px-4 py-16 text-sm text-rose-300 sm:px-6">{error}</main></div>
  if(!report)return <div className="min-h-screen"><Nav/><main className="mx-auto max-w-4xl px-4 py-16 text-sm text-[#77736c] sm:px-6">Building report…</main></div>
  return <div className="min-h-screen"><Nav/><main className="mx-auto max-w-5xl px-4 py-7 pb-16 sm:px-6 sm:py-10 sm:pb-20">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Link href={`/repositories/${params.id}`} className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#66625b] transition hover:text-white"><ArrowLeft size={14}/> Repository</Link><button onClick={()=>window.print()} className="print-hide inline-flex min-h-10 items-center justify-center gap-2 border border-white/[.1] px-4 py-2 text-sm text-[#aaa69e] transition hover:bg-white/[.04]"><Download size={15}/> Print / Save PDF</button></div>
    <div className="mt-8 border-b border-white/[.08] pb-7 reveal"><div className="flex items-center gap-2 text-amber-300"><FileText size={18}/><span className="font-mono text-[10px] uppercase tracking-[.16em]">Developer report</span></div><h1 className="mt-2 break-all text-2xl font-semibold tracking-tight sm:text-4xl">{report.repository.owner}/{report.repository.name}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#77736c]">{report.summary}</p></div>
    <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">{[['Files',report.metrics?.total_files||0],['Code lines',(report.metrics?.code_lines||0).toLocaleString()],['Interview',report.interview?.score??'—']].map(([l,v],i)=><div key={l as string} className={`card reveal reveal-delay-${i+1} p-4 sm:p-5`}><div className="font-mono text-[9px] uppercase tracking-[.15em] text-[#5f5b55]">{l}</div><div className="mt-2 text-2xl font-semibold">{v}{l==='Interview'&&report.interview?<span className="text-base text-[#55514b]">/100</span>:null}</div></div>)}</div>
    <section className="card mt-6 p-5 sm:p-6 reveal"><div className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-400">/ AI review</div><h2 className="mt-2 text-lg font-semibold">Repository assessment</h2><p className="mt-3 text-sm leading-6 text-[#8a867f]">{report.ai_insights?.architecture_explanation}</p><div className="mt-5 grid gap-2.5 sm:grid-cols-2">{(report.ai_insights?.strengths||[]).map((x:string)=><div key={x} className="border border-emerald-400/10 bg-emerald-400/[.035] p-3 text-sm leading-5 text-[#aaa69e]">{x}</div>)}{(report.ai_insights?.priorities||[]).map((x:string)=><div key={x} className="border border-amber-400/10 bg-amber-400/[.035] p-3 text-sm leading-5 text-[#aaa69e]">{x}</div>)}</div></section>
    <section className="mt-7 reveal"><div className="mb-3 flex items-center gap-2"><ShieldAlert size={18} className="text-amber-300"/><h2 className="text-lg font-semibold">Findings ({report.findings?.length||0})</h2></div><div className="space-y-2.5">{(report.findings||[]).map((f:any,i:number)=><div key={i} className="card interactive-card p-4"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{f.title}</span><span className="border border-white/[.08] bg-white/[.03] px-2 py-0.5 font-mono text-[9px] uppercase text-[#66625b]">{f.severity}</span></div><p className="mt-2 text-sm leading-6 text-[#77736c]">{f.description}</p>{f.file_path&&<div className="mt-2 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-amber-300/80">{f.file_path}{f.line?`:${f.line}`:''}</div>}</div>)}</div></section>
  </main></div>
}
