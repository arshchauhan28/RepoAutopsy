import Link from "next/link";

import {
  ArrowRight,
  Bot,
  Code2,
  GitBranch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Nav } from "@/components/Nav";

const features = [
  {
    icon: GitBranch,
    title: "Repository understanding",
    text: "Turn a GitHub URL into a structured map of files, languages, architecture and dependencies.",
  },
  {
    icon: Code2,
    title: "Codebase Doctor",
    text: "Surface security patterns, oversized functions, documentation gaps and quality signals.",
  },
  {
    icon: Bot,
    title: "AI Interviewer",
    text: "Generate questions from the actual project and evaluate answers against repository evidence.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <Nav />

      <main className="grid-bg">
        <section className="mx-auto max-w-7xl px-5 pb-20 pt-20 sm:pt-28">
          <div className="max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs text-violet-200">
              <Sparkles size={14} />
              Code intelligence for real repositories
            </div>

            <h1 className="text-5xl font-semibold leading-[1.03] tracking-[-.045em] sm:text-7xl">
              Understand the codebase.
              <br />
              <span className="bg-gradient-to-r from-violet-300 via-white to-cyan-300 bg-clip-text text-transparent">
                Then defend it.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              RepoAutopsy combines deterministic repository analysis with an AI
              technical interviewer. Paste a GitHub repository and get a
              developer-focused review, architecture map and project-specific
              interview.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/analyze"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/10 transition-all duration-200 hover:from-violet-500 hover:to-cyan-400 hover:shadow-violet-500/20"
              >
                Analyze a repository
                <ArrowRight size={16} />
              </Link>

              <a
                href="#how"
                className="rounded-xl border border-white/10 px-5 py-3 text-sm text-slate-300 hover:bg-white/5"
              >
                How it works
              </a>
            </div>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card p-6">
                <div className="mb-8 grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-violet-300">
                  <Icon size={20} />
                </div>

                <h2 className="font-medium text-white">{title}</h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="mx-auto max-w-7xl px-5 pb-24">
          <div className="card grid overflow-hidden lg:grid-cols-[1.1fr_.9fr]">
            <div className="p-8 sm:p-12">
              <div className="text-xs uppercase tracking-[.16em] text-slate-500">
                The pipeline
              </div>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Static evidence first. AI second.
              </h2>

              <div className="mt-8 space-y-5 text-sm text-slate-400">
                <div>
                  <span className="font-medium text-white">01 · Fetch</span>
                  <p className="mt-1">
                    Retrieve the repository safely from GitHub with size and
                    file limits.
                  </p>
                </div>

                <div>
                  <span className="font-medium text-white">02 · Analyze</span>
                  <p className="mt-1">
                    Inspect languages, structure, imports, metrics and
                    deterministic findings.
                  </p>
                </div>

                <div>
                  <span className="font-medium text-white">03 · Interview</span>
                  <p className="mt-1">
                    Use repository context to generate and evaluate
                    project-specific technical questions.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative min-h-[340px] bg-[#080c16] p-8">
              <div className="absolute inset-8 rounded-2xl border border-white/10 bg-[#0b1120] p-5 font-mono text-xs text-slate-400 shadow-2xl">
                <div className="text-violet-300">repository.analysis()</div>

                <div className="mt-5 space-y-2">
                  <div>✓ GitHub repository fetched</div>
                  <div>✓ 146 files parsed</div>
                  <div>✓ 4 languages detected</div>
                  <div>✓ architecture graph built</div>
                  <div className="text-amber-300">! 7 quality findings</div>
                  <div className="text-emerald-300">
                    ✓ interview context prepared
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
