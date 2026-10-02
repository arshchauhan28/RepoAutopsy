import Link from 'next/link'
import { ArrowRight, Check, CircleAlert, Code2, FileCode2, GitBranch, Network, ScanSearch, ShieldCheck } from 'lucide-react'
import { Nav } from '@/components/Nav'

const capabilities = [
  { icon: GitBranch, number: '01', title: 'Repository map', text: 'Files, languages, imports, dependencies and structure — turned into a technical map.' },
  { icon: ShieldCheck, number: '02', title: 'Codebase Doctor', text: 'Static findings that point you toward quality, security and maintainability issues.' },
  { icon: Code2, number: '03', title: 'Technical interview', text: 'Questions generated from the repository so you can explain what you actually built.' },
]

export default function Home() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="grid-bg overflow-hidden">
        <section className="border-b border-white/[.08]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
              <div className="reveal">
                <div className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-[#77736c] sm:text-[11px]">
                  <span className="h-1.5 w-1.5 animate-glow rounded-full bg-amber-400" />
                  Codebase intelligence
                </div>
                <h1 className="max-w-3xl text-[2.8rem] font-semibold leading-[.98] tracking-[-.055em] sm:text-6xl lg:text-7xl">
                  Understand the codebase.
                  <span className="mt-2 block text-[#77736c]">Then defend it.</span>
                </h1>
                <p className="mt-6 max-w-xl text-[15px] leading-7 text-[#8a867f] sm:mt-7 sm:text-base">
                  RepoAutopsy turns a GitHub repository into structured technical evidence, an architecture map, a codebase review and a project-specific interview.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/analyze" className="group inline-flex min-h-12 w-full items-center justify-center gap-2 border border-amber-400/40 bg-amber-400 px-5 py-3 text-sm font-semibold text-black transition duration-200 hover:bg-amber-300 active:scale-[.99] sm:w-auto">
                    Analyze a repository <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <a href="#how" className="inline-flex min-h-12 w-full items-center justify-center border border-white/[.1] px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-[#aaa69e] transition hover:bg-white/[.04] sm:w-auto">How it works</a>
                </div>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[9px] uppercase tracking-[.13em] text-[#5f5b55] sm:text-[10px]">
                  <span>GitHub URL</span><span>Static analysis</span><span>AI interview</span>
                </div>
              </div>

              <div className="reveal reveal-delay-2 relative border border-white/[.1] bg-[#0d0f12] shadow-2xl shadow-black/20">
                <div className="scan-overlay" />
                <div className="flex items-center justify-between border-b border-white/[.08] px-4 py-3">
                  <div className="flex gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400/60"/><span className="h-2 w-2 rounded-full bg-amber-400/60"/><span className="h-2 w-2 rounded-full bg-emerald-400/60"/></div>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[#55514b]">analysis.log</span>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="font-mono text-xs leading-7 sm:text-sm">
                    <div className="text-[#77736c]">$ repoautopsy analyze</div>
                    <div className="mt-3 text-[#aaa69e]">target:<span className="ml-2 text-[#e8e6e1]">github.com/user/project</span></div>
                    <div className="mt-4 space-y-1.5 text-[#8a867f]">
                      {['repository fetched','146 files parsed','4 languages detected','architecture graph built'].map(x => <div key={x} className="flex items-center gap-2"><Check size={13} className="text-emerald-400"/>{x}</div>)}
                      <div className="flex items-center gap-2 text-amber-300"><CircleAlert size={13}/>7 quality findings</div>
                    </div>
                    <div className="mt-5 border-t border-white/[.07] pt-4 text-[#625e57]">analysis complete<span className="ml-1 animate-pulse text-amber-400">_</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.08]">
          <div className="mx-auto grid max-w-7xl grid-cols-2 sm:grid-cols-4">
            {[['146','FILES'],['4','LANGUAGES'],['7','FINDINGS'],['1','ARCHITECTURE']].map(([v,l],i)=>(
              <div key={l} className={`border-white/[.08] px-4 py-5 sm:px-6 sm:py-6 ${i % 2 === 0 ? 'border-r sm:border-r' : ''} ${i === 1 ? 'sm:border-r' : ''}`}>
                <div className="font-mono text-2xl text-[#e8e6e1] sm:text-3xl">{v}</div><div className="mt-1 font-mono text-[9px] tracking-[.15em] text-[#5f5b55]">{l}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-white/[.08]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <div className="mb-8 reveal"><div className="font-mono text-[10px] uppercase tracking-[.18em] text-amber-400">/ capabilities</div><h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">One repository. Multiple layers of inspection.</h2></div>
            <div className="grid gap-px overflow-hidden border border-white/[.08] bg-white/[.08] md:grid-cols-3">
              {capabilities.map(({icon:Icon,number,title,text},i)=><div key={title} className={`reveal reveal-delay-${i+1} interactive-card bg-[#0d0f12] p-5 sm:p-7`}><div className="flex items-center justify-between"><Icon size={19} className="text-[#aaa69e]"/><span className="font-mono text-[10px] text-[#55514b]">{number}</span></div><h3 className="mt-9 text-base font-medium">{title}</h3><p className="mt-2 text-sm leading-6 text-[#77736c]">{text}</p></div>)}
            </div>
          </div>
        </section>

        <section id="how">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
              <div className="reveal"><div className="font-mono text-[10px] uppercase tracking-[.18em] text-amber-400">/ methodology</div><h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Static evidence first.<span className="block text-[#77736c]">AI second.</span></h2><p className="mt-5 max-w-md text-sm leading-6 text-[#77736c]">The AI layer works from repository context instead of pretending to understand code it has never inspected.</p></div>
              <div className="divide-y divide-white/[.08] border-y border-white/[.08]">
                {[['01','Fetch','Retrieve the repository safely from GitHub.'],['02','Analyze','Inspect structure, languages, imports, metrics and findings.'],['03','Interview','Generate and evaluate project-specific technical questions.']].map(([n,t,d],i)=><div key={n} className={`reveal reveal-delay-${i+1} flex gap-4 py-5 sm:gap-6`}><span className="font-mono text-[11px] text-[#55514b]">{n}</span><div><h3 className="text-sm font-medium">{t}</h3><p className="mt-1 text-sm leading-6 text-[#77736c]">{d}</p></div></div>)}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[.08]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"><div className="border border-white/[.1] bg-[#0d0f12] p-5 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-mono text-[9px] uppercase tracking-[.18em] text-[#66625b]">ready when you are</div><h2 className="mt-2 text-xl font-semibold sm:text-2xl">Put a repository on the table.</h2></div><Link href="/analyze" className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-amber-400/40 bg-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-300 sm:w-auto">Start analysis <ArrowRight size={16}/></Link></div></div></div>
        </section>
      </main>
    </div>
  )
}
