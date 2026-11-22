export type Finding = {
  id: string
  category: string
  severity: string
  confidence?: string | null
  title: string
  description: string
  file_path?: string | null
  line?: number | null
  recommendation?: string | null
  why_it_matters?: string | null
  evidence?: string | null
  suggested_fix?: string | null
  root_cause_group?: string | null
}

export type FileHierarchyNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  extension?: string
  lines?: number
  size?: number
  file_count?: number
  total_lines?: number
  total_size?: number
  children?: FileHierarchyNode[]
}

export type ComponentSummary = {
  id: string
  name: string
  layer: string
  file_count: number
  total_lines: number
  technologies: string[]
  role: string
  files?: { path: string; lines: number }[]
  sample_files?: string[]
  incoming_connections?: { component_id: string; weight: number }[]
  outgoing_connections?: { component_id: string; weight: number }[]
}

export type DependencyNode = {
  id: string
  label: string
  path: string
  type: 'internal' | 'external'
  lines?: number
  extension?: string
  usage_count?: number
  in_degree?: number
  out_degree?: number
  is_circular?: boolean
}

export type DependencyEdge = {
  id: string
  source: string
  target: string
  import_name?: string
  is_external?: boolean
  is_circular?: boolean
}

export type GroupedModuleNode = {
  id: string
  label: string
  path: string
  module_count: number
  lines: number
  modules: string[]
  external_packages: string[]
  in_degree: number
  out_degree: number
}

export type GroupedModuleEdge = {
  id: string
  source: string
  target: string
  weight: number
  label?: string
}

export type GroupedModulesData = {
  groups: GroupedModuleNode[]
  edges: GroupedModuleEdge[]
}

export type DependencyGraph = {
  nodes: DependencyNode[]
  edges: DependencyEdge[]
  grouped_modules?: GroupedModulesData
  circular_dependencies: string[][]
  external_packages: { package: string; usage_count: number }[]
  summary: {
    internal_modules_count: number
    external_packages_count: number
    total_dependencies_count: number
    circular_cycles_count: number
  }
}

export type Recommendation = {
  id: string
  title: string
  priority: 'Fix Now' | 'Improve Later' | string
  category: string
  why_it_matters: string
  evidence: string
  recommended_approach: string
  expected_benefit: string
  related_finding_ids?: string[]
  // Legacy fields
  solution?: string
  explanation?: string
}

export type CodebaseBriefing = {
  is_ai_generated?: boolean
  mode_label?: string
  model?: string
  transparency_note?: string
  project_overview?: {
    summary: string
    primary_purpose: string
    technologies: string[]
    codebase_organization: string
  }
  architecture_assessment?: {
    key_components: string[]
    component_relationships: string
    frontend_backend_separation?: string
    data_persistence?: string
    strengths?: string[]
    concerns?: string[]
  }
  architectural_strengths?: string[]
  architectural_concerns?: string[]
  analysis_limitations?: string[]
  findings_summary?: {
    critical_count: number
    high_count: number
    medium_count: number
    low_count: number
    total_high_priority: number
  }
  recommendations?: Recommendation[]
  // Legacy backward-compatibility fields
  summary?: string
  strengths?: string[]
  priorities?: string[]
  architecture_explanation?: string
  top_recommendations?: Recommendation[]
  engineering_questions?: string[]
}

export type ArchitectureData = {
  components?: ComponentSummary[]
  overview_nodes?: any[]
  overview_edges?: any[]
  dependency_graph?: DependencyGraph
  file_hierarchy?: FileHierarchyNode
  coverage?: {
    analyzed_files: number
    total_discovered_files: number
    is_partial: boolean
    limit_reason?: string | null
  }
  // Legacy fields
  nodes?: any[]
  edges?: any[]
  top_level?: Record<string, number>
  ecosystem?: string[]
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
  architecture?: ArchitectureData
  metrics?: any
  file_tree?: any[]
  languages?: Record<string, number>
  ai_insights?: CodebaseBriefing
  analyzer_version?: string | null
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
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`)
  return data
}

export function createAnalysis(github_url: string) {
  return request<Analysis>('/api/v1/analyses', { method: 'POST', body: JSON.stringify({ github_url }) })
}

export function getAnalysis(id: string) {
  return request<Analysis>(`/api/v1/analyses/${id}`)
}

export function startInterview(id: string, question_count = 8) {
  return request<Interview>(`/api/v1/interviews/analysis/${id}`, {
    method: 'POST',
    body: JSON.stringify({ question_count }),
  })
}

export function getInterview(id: string) {
  return request<Interview>(`/api/v1/interviews/${id}`)
}

export function answerInterview(id: string, answer: string) {
  return request<Interview>(`/api/v1/interviews/${id}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  })
}

export function getReport(id: string) {
  return request<any>(`/api/v1/reports/${id}`)
}

export function rerunAnalysis(id: string) {
  return request<Analysis>(`/api/v1/analyses/${id}/rerun`, { method: 'POST' })
}
