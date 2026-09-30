export type Finding = {
  id: string
  category: string
  severity: string
  title: string
  description: string
  file_path?: string | null
  line?: number | null
  recommendation?: string | null
}

export type Analysis = {
  id: string
  github_url: string
  owner: string
  repo_name: string
  default_branch?: string | null
  commit_sha?: string | null
  status: string
  error?: string | null
  summary?: string | null
  architecture?: any
  metrics?: any
  file_tree?: any[]
  languages?: Record<string, number>
  ai_insights?: any
  findings: Finding[]
}

export type Interview = {
  id: string
  analysis_id: string
  status: string
  current_index: number
  score?: number | null
  feedback?: any
  turns: { id: string; question_index: number; question: string; answer?: string | null; evaluation?: any }[]
}

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }, cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`)
  return data
}

export function createAnalysis(github_url: string) {
  return request<Analysis>('/api/v1/analyses', { method: 'POST', body: JSON.stringify({ github_url }) })
}
export function getAnalysis(id: string) { return request<Analysis>(`/api/v1/analyses/${id}`) }
export function startInterview(id: string, question_count = 8) { return request<Interview>(`/api/v1/interviews/analysis/${id}`, { method: 'POST', body: JSON.stringify({ question_count }) }) }
export function getInterview(id: string) { return request<Interview>(`/api/v1/interviews/${id}`) }
export function answerInterview(id: string, answer: string) { return request<Interview>(`/api/v1/interviews/${id}/answer`, { method: 'POST', body: JSON.stringify({ answer }) }) }
export function getReport(id: string) { return request<any>(`/api/v1/reports/${id}`) }
