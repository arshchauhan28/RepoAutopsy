'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Download, FileText, ShieldAlert } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { getReport } from '@/lib/api'

export default function ReportPage() {
  const params = useParams<{id:string}>(); const [report,setReport]=useState<any>(null); const [error,setError]=useState('')
  useEffect(()=>{getReport(params.id).then(setReport).catch(e=>setError(e.message))},[params.id])
  if (error) return <div className="min-h-screen"><Nav/><main className="mx-auto max-w-4xl px-5 py-20 text-rose-300">{error}</main></div>
  if (!report) return <div className="min-h-screen"><Nav/><main className="mx-auto max-w-4xl px-5 py-20 text-slate-400">Building report…</main></div>
  return <div className="min-h-screen"><Nav/><main className="mx-auto max-w-5xl px-5 py-10 pb-20"><div className="flex flex-wrap items-center justify-between gap-4"><Link href={`/repositories/${params.id}`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-white"><ArrowLeft size={15}/> Repository</Link><button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"><Download size={15}/> Print / Save PDF</button></div><div className="mt-9"><div className="flex items-center gap-2 text-violet-300"><FileText size={19}/> Developer report</div><h1 className="mt-2 text-4xl font-semibold tracking-tight">{report.repository.owner}/{report.repository.name}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{report.summary}</p></div>
  <div className="mt-8 grid gap-4 sm:grid-cols-3"><div className="card p-5"><div className="text-xs text-slate-500">Files</div><div className="mt-2 text-2xl font-semibold">{report.metrics?.total_files || 0}</div></div><div className="card p-5"><div className="text-xs text-slate-500">Code lines</div><div className="mt-2 text-2xl font-semibold">{(report.metrics?.code_lines || 0).toLocaleString()}</div></div><div className="card p-5"><div className="text-xs text-slate-500">Interview</div><div className="mt-2 text-2xl font-semibold">{report.interview?.score ?? '—'}<span className="text-base text-slate-600">{report.interview ? '/100' : ''}</span></div></div></div>
  <section className="card mt-7 p-6"><h2 className="text-lg font-semibold">AI review</h2><p className="mt-3 text-sm leading-6 text-slate-400">{report.ai_insights?.architecture_explanation}</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{(report.ai_insights?.strengths || []).map((x:string)=><div key={x} className="rounded-xl bg-emerald-400/5 p-3 text-sm text-slate-300">{x}</div>)}{(report.ai_insights?.priorities || []).map((x:string)=><div key={x} className="rounded-xl bg-amber-400/5 p-3 text-sm text-slate-300">{x}</div>)}</div></section>
  <section className="mt-7"><div className="mb-3 flex items-center gap-2"><ShieldAlert size={18} className="text-amber-300"/><h2 className="text-lg font-semibold">Findings ({report.findings?.length || 0})</h2></div><div className="space-y-3">{(report.findings || []).map((f:any,i:number)=><div key={i} className="card p-4"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{f.title}</span><span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase text-slate-500">{f.severity}</span></div><p className="mt-2 text-sm leading-6 text-slate-400">{f.description}</p>{f.file_path&&<div className="mt-2 font-mono text-xs text-violet-300">{f.file_path}{f.line ? `:${f.line}`:''}</div>}</div>)}</div></section>
  </main></div>
}
