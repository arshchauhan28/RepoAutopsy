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
  rule_id?: string
  evidence_type?: string
  confidence_classification?: string
  source_reference?: {
    file_path: string
    start_line: number
    end_line: number
    symbol: string
    evidence_type: string
  } | null
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
    total_files?: number
    eligible_source_files?: number
    successfully_parsed?: number
    partially_analyzed?: number
    unsupported_files?: number
    skipped_files?: number
    failed_files?: number
    languages_supported?: Record<string, string>
    category_counts?: Record<string, number>
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

export type AssessableComponent = {
  id: string
  name: string
  layer: string
  role: string
  file_count: number
  total_lines: number
  technologies: string[]
  sample_files: string[]
  has_sufficient_evidence: boolean
  confidence: string
  subcomponents?: { id: string; name: string; files: string[]; file_count: number }[]
  symbols?: string[]
}

export type AssessmentTurn = {
  id: string
  question_index: number
  question: string
  question_type: 'multiple_choice' | 'short_answer' | 'code_interpretation' | 'code_understanding' | 'scenario' | string
  category: string
  difficulty: string
  options?: string[] | null
  code_snippet?: string | null
  relevant_files?: string[] | null
  selected_option?: number | null
  answer?: string | null
  earned_score?: number | null
  max_score: number
  evaluation?: any
  explanation?: string | null
  rubric?: any
  evidence_confidence?: 'high' | 'medium' | 'insufficient' | string
  retry_count?: number
  user_notes?: string | null
  question_version?: string
  source_reference?: {
    file_path?: string | null
    symbol?: string | null
    evidence_type?: string | null
  } | null
  disclaimer?: string | null
}

export type AssessmentSession = {
  id: string
  session_token?: string | null
  analysis_id: string
  status: 'active' | 'completed' | 'abandoned'
  current_index: number
  score?: number | null
  feedback?: any
  assessment_type: 'complete' | 'component' | 'team'
  scope_type: 'complete' | 'component'
  selected_components?: string[] | null
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  question_count: number
  evaluation_mode: string
  category_scores?: Record<string, number> | null
  participant_name?: string | null
  team_session_id?: string | null
  team_member_id?: string | null
  hackathon_mode?: number
  hackathon_context?: any
  mode?: 'assessment' | 'practice'
  knowledge_gaps?: any[] | null
  parent_session_id?: string | null
  comparison_data?: any | null
  turns: AssessmentTurn[]
}

// Backward-compatibility alias
export type Interview = AssessmentSession

export type TeamMemberSlot = {
  id?: string
  display_name: string
  assigned_role?: string | null
  assigned_components: string[]
  difficulty: string
  question_count: number
  status?: string
  score?: number | null
  category_scores?: Record<string, number> | null
  completed_at?: string | null
}

export type CreateTeamSessionPayload = {
  analysis_id: string
  team_name: string
  description?: string
  is_hackathon_mode?: boolean
  hackathon_context?: {
    problem_statement?: string
    target_users?: string
    demo_workflow?: string
  }
  members: TeamMemberSlot[]
}

export type TeamSessionData = {
  id: string
  team_name: string
  description?: string | null
  status: string
  is_hackathon_mode: boolean
  hackathon_context?: any
  created_at: string
  total_members: number
  completed_members: number
  in_progress_members: number
  invited_members: number
  team_average_score?: number | null
  members: TeamMemberSlot[]
  coverage_matrix: {
    component_id: string
    component_name: string
    layer: string
    file_count: number
    status: 'assessed' | 'in_progress' | 'unassessed'
    coverage_level?: 'High' | 'Medium' | 'Low' | 'Unassessed'
    demonstrated_understanding?: 'Strong' | 'Moderate' | 'Developing' | 'Insufficient Evidence'
    average_score?: number | null
    assigned_members: string[]
    completed_members: string[]
  }[]
  team_strengths: string[]
  team_knowledge_gaps: string[]
  team_readiness_summary?: string | null
  hackathon_insights: string[]
  is_organizer?: boolean
  organizer_token?: string
  invite_token?: string
}

export type TeamInviteInfo = {
  session_id: string
  analysis_id?: string
  team_name: string
  description?: string | null
  repo_name: string
  is_hackathon_mode: boolean
  available_slots: {
    id: string
    display_name: string
    assigned_role?: string | null
    assigned_components: string[]
    status: string
  }[]
}

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
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

export function startInterview(id: string, question_count = 10) {
  return request<Interview>(`/api/v1/interviews/analysis/${id}`, {
    method: 'POST',
    body: JSON.stringify({ question_count }),
  })
}

export function getInterview(id: string, sessionToken?: string) {
  return request<AssessmentSession>(`/api/v1/interviews/${id}`, {
    headers: sessionToken ? { 'X-Session-Token': sessionToken } : undefined,
  })
}

export function answerInterview(id: string, answer: string, sessionToken?: string) {
  return request<AssessmentSession>(`/api/v1/interviews/${id}/answer`, {
    method: 'POST',
    headers: sessionToken ? { 'X-Session-Token': sessionToken } : undefined,
    body: JSON.stringify({ answer }),
  })
}

export function getAssessableComponents(analysisId: string) {
  return request<AssessableComponent[]>(`/api/v1/interviews/analysis/${analysisId}/components`)
}

export function startAssessment(analysisId: string, payload: any) {
  return request<AssessmentSession>(`/api/v1/interviews/analysis/${analysisId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function answerAssessmentTurn(
  sessionId: string,
  payload: { answer?: string; selected_option?: number | null; question_index?: number },
  sessionToken?: string
) {
  return request<AssessmentSession>(`/api/v1/interviews/${sessionId}/answer`, {
    method: 'POST',
    headers: sessionToken ? { 'X-Session-Token': sessionToken } : undefined,
    body: JSON.stringify(payload),
  })
}

export function submitAssessment(
  sessionId: string,
  payload: { answers: { question_index: number; answer?: string; selected_option?: number | null }[] },
  sessionToken?: string
) {
  return request<AssessmentSession>(`/api/v1/interviews/${sessionId}/submit`, {
    method: 'POST',
    headers: sessionToken ? { 'X-Session-Token': sessionToken } : undefined,
    body: JSON.stringify(payload),
  })
}

export function getAssessmentHistory(analysisId: string) {
  return request<any[]>(`/api/v1/interviews/analysis/${analysisId}/history`)
}

export function createTeamSession(payload: CreateTeamSessionPayload) {
  return request<{
    id: string
    team_name: string
    organizer_token: string
    invite_token: string
    status: string
    is_hackathon_mode: boolean
    invite_url: string
  }>('/api/v1/interviews/team/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getTeamSession(sessionId: string, organizerToken?: string, inviteToken?: string) {
  const headers: Record<string, string> = {}
  if (organizerToken) headers['X-Organizer-Token'] = organizerToken
  if (inviteToken) headers['X-Invite-Token'] = inviteToken

  return request<TeamSessionData>(`/api/v1/interviews/team/sessions/${sessionId}`, {
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  })
}

export function revokeTeamInvitation(sessionId: string, organizerToken: string) {
  return request<{ status: string; new_invite_token: string; invite_url: string }>(
    `/api/v1/interviews/team/sessions/${sessionId}/revoke-invite`,
    {
      method: 'POST',
      headers: { 'X-Organizer-Token': organizerToken },
    }
  )
}

export function closeTeamSession(sessionId: string, organizerToken: string) {
  return request<{ status: string; id: string }>(
    `/api/v1/interviews/team/sessions/${sessionId}/close`,
    {
      method: 'POST',
      headers: { 'X-Organizer-Token': organizerToken },
    }
  )
}

export function getTeamInviteInfo(inviteToken: string) {
  return request<TeamInviteInfo>(`/api/v1/interviews/team/invite/${inviteToken}`)
}

export function joinTeamSession(inviteToken: string, payload: { display_name: string; member_id?: string }) {
  return request<{
    team_session_id: string
    member_id: string
    assessment_session_id: string
    session_token?: string
    status: string
  }>(`/api/v1/interviews/team/join/${inviteToken}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getTeamSessionsForRepo(analysisId: string) {
  return request<any[]>(`/api/v1/interviews/team/analysis/${analysisId}/sessions`)
}

export function getReport(id: string) {
  return request<any>(`/api/v1/reports/${id}`)
}

export function rerunAnalysis(id: string) {
  return request<Analysis>(`/api/v1/analyses/${id}/rerun`, { method: 'POST' })
}

export type ShareableReport = {
  repository_name: string
  assessment_id: string
  assessment_type: string
  scope_type: string
  selected_components?: string[] | null
  difficulty: string
  overall_score?: number | null
  category_scores?: Record<string, number> | null
  total_questions: number
  completed_questions: number
  completion_date?: string | null
  strengths: string[]
  knowledge_gaps: {
    category: string
    component?: string | null
    title: string
    description: string
    missing_concepts: string[]
    supporting_files: string[]
    actionable_recommendation: string
    suggested_review_topics: string[]
  }[]
  coverage_limitations?: string | null
  is_team: boolean
  team_name?: string | null
  team_coverage_matrix?: any[] | null
  team_readiness_summary?: string | null
  hackathon_insights: string[]
}

export function getKnowledgeModel(analysisId: string) {
  return request<any>(`/api/v1/interviews/analysis/${analysisId}/knowledge-model`)
}

export function getShareableReport(sessionId: string, sessionToken?: string) {
  return request<ShareableReport>(`/api/v1/interviews/${sessionId}/report`, {
    headers: sessionToken ? { 'X-Session-Token': sessionToken } : undefined,
  })
}

export function startPracticeSession(sessionId: string, sessionToken?: string) {
  return request<AssessmentSession>(`/api/v1/interviews/${sessionId}/practice`, {
    method: 'POST',
    headers: sessionToken ? { 'X-Session-Token': sessionToken } : undefined,
  })
}

export function retryPracticeTurn(
  sessionId: string,
  turnId: string,
  payload: { selected_option?: number | null; answer?: string; user_notes?: string },
  sessionToken?: string
) {
  return request<AssessmentTurn>(`/api/v1/interviews/${sessionId}/turns/${turnId}/retry`, {
    method: 'POST',
    headers: sessionToken ? { 'X-Session-Token': sessionToken } : undefined,
    body: JSON.stringify(payload),
  })
}

export function retakeAssessment(
  sessionId: string,
  payload: { difficulty?: string; question_count?: number; target_weak_areas?: boolean; participant_name?: string },
  sessionToken?: string
) {
  return request<AssessmentSession>(`/api/v1/interviews/${sessionId}/retake`, {
    method: 'POST',
    headers: sessionToken ? { 'X-Session-Token': sessionToken } : undefined,
    body: JSON.stringify(payload),
  })
}

export function getTeamReadinessReport(sessionId: string, organizerToken?: string, inviteToken?: string) {
  const headers: Record<string, string> = {}
  if (organizerToken) headers['X-Organizer-Token'] = organizerToken
  if (inviteToken) headers['X-Invite-Token'] = inviteToken

  return request<ShareableReport>(`/api/v1/interviews/team/sessions/${sessionId}/readiness-report`, {
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  })
}

// ==============================================================================
// PULL REQUEST AUTOPSY TYPES & API (SPRINT 3)
// ==============================================================================

export type PRChangedFile = {
  filename: string
  previous_filename?: string | null
  status: 'modified' | 'added' | 'removed' | 'renamed'
  additions: number
  deletions: number
  changes: number
  patch?: string | null
  is_binary?: boolean
  is_truncated?: boolean
  component_id?: string | null
  component_name?: string | null
}

export type PRChangeImpact = {
  affected_component_id: string
  affected_component_name: string
  impact_type: 'direct' | 'downstream_consumer' | 'contract_risk' | 'test_impact'
  confidence: 'high' | 'medium' | 'low'
  relevant_changed_file: string
  dependency_evidence: string
  explanation: string
}

export type DiagnosticsDeltaFinding = {
  fingerprint: string
  title: string
  category: string
  severity: string
  file_path?: string | null
  line?: number | null
  description: string
  status: 'new' | 'resolved' | 'unchanged'
}

export type DiagnosticsDelta = {
  new_findings: DiagnosticsDeltaFinding[]
  resolved_findings: DiagnosticsDeltaFinding[]
  unchanged_findings: DiagnosticsDeltaFinding[]
  new_high_severity_count: number
  resolved_count: number
}

export type ArchitectureDelta = {
  added_modules: string[]
  removed_modules: string[]
  new_dependencies: { file: string; package: string; status: string }[]
  new_circular_cycles: string[][]
  resolved_circular_cycles: string[][]
  changed_service_boundaries: string[]
}

export type TestRecommendation = {
  category: string
  target_module: string
  recommended_test_files: string[]
  rationale: string
}

export type PullRequestAnalysis = {
  id: string
  analysis_id?: string | null
  repo_owner: string
  repo_name: string
  pr_number: number
  pr_title: string
  pr_description?: string | null
  pr_author?: string | null
  base_branch: string
  head_branch: string
  base_sha: string
  head_sha: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  changed_files_count: number
  additions: number
  deletions: number
  review_priority: 'high' | 'medium' | 'low'
  review_priority_reasons: string[]
  analysis_coverage?: string
  comparison_scope?: 'full_base_head' | 'changed_files_with_ast_context' | 'partial_patch' | string
  summary?: {
    pr_number: number
    title: string
    author?: string | null
    total_files_changed: number
    total_additions: number
    total_deletions: number
    review_priority: string
    key_impact_components: string[]
    new_regressions_count: number
    resolved_findings_count: number
    executive_summary: string
    analysis_coverage?: string
  } | null
  changed_files: PRChangedFile[]
  change_impacts: PRChangeImpact[]
  architecture_delta?: ArchitectureDelta | null
  diagnostics_delta?: DiagnosticsDelta | null
  test_recommendations: TestRecommendation[]
  limitations: string[]
  created_at: string
  completed_at?: string | null
}

export function analyzePullRequest(url: string, repositoryId?: string) {
  return request<PullRequestAnalysis>('/api/v1/pull-requests/analyze', {
    method: 'POST',
    body: JSON.stringify({ url, repository_id: repositoryId }),
  })
}

export function getPullRequestAnalysis(prAnalysisId: string) {
  return request<PullRequestAnalysis>(`/api/v1/pull-requests/${prAnalysisId}`)
}

export function getPullRequestByNumber(owner: string, repo: string, prNumber: number) {
  return request<PullRequestAnalysis>(`/api/v1/pull-requests/by-repo/${owner}/${repo}/${prNumber}`)
}

export function getPullRequestReport(prAnalysisId: string) {
  return request<{
    pr_number: number
    pr_title: string
    repo: string
    review_priority: string
    markdown: string
    summary: any
    diagnostics_delta: any
    change_impacts: any[]
    test_recommendations: any[]
  }>(`/api/v1/pull-requests/${prAnalysisId}/report`)
}

// =========================================================================
// SPRINT 4: AUTH, WORKSPACES, DASHBOARD, AUTOMATION & NOTIFICATIONS
// =========================================================================

export type User = {
  id: string
  github_id: string
  username: string
  display_name?: string | null
  avatar_url?: string | null
  email?: string | null
  is_active: boolean
  created_at: string
  last_login_at: string
}

export type AuthStatus = {
  authenticated: boolean
  user: User | null
}

export type Workspace = {
  id: string
  name: string
  description?: string | null
  workspace_type: 'personal' | 'team' | 'org'
  owner_id: string
  status: string
  member_count: number
  repository_count: number
  current_user_role: 'owner' | 'admin' | 'member' | 'viewer'
  created_at: string
  updated_at: string
}

export type WorkspaceMember = {
  id: string
  workspace_id: string
  user_id: string
  username: string
  display_name?: string | null
  avatar_url?: string | null
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joined_at: string
}

export type WorkspaceInvitation = {
  id: string
  workspace_id: string
  role: string
  invite_url: string
  invite_token: string
  target_email?: string | null
  target_github_username?: string | null
  expires_at: string
  created_at: string
}

export type AutomationSettings = {
  id: string
  connected_repo_id: string
  is_enabled: boolean
  analyze_on_pr_opened: boolean
  analyze_on_pr_synchronize: boolean
  analyze_on_pr_reopened: boolean
  max_files_limit: number
  notify_on_priority: string
  created_at: string
  updated_at: string
}

export type ConnectedRepository = {
  id: string
  workspace_id: string
  github_repo_id?: string | null
  owner: string
  repo_name: string
  github_url: string
  default_branch: string
  is_private: boolean
  connection_status: 'connected' | 'syncing' | 'access_required' | 'error'
  last_synced_at?: string | null
  created_at: string
  automation_settings?: AutomationSettings | null
}

export type NotificationItem = {
  id: string
  title: string
  message: string
  notification_type: string
  resource_url?: string | null
  resource_id?: string | null
  is_read: boolean
  created_at: string
}

export type DashboardSummary = {
  user: {
    id: string
    username: string
    display_name?: string | null
    avatar_url?: string | null
    email?: string | null
  }
  metrics: {
    connected_repositories_count: number
    workspaces_count: number
    analyses_count: number
    pr_analyses_count: number
    codevitals_sessions_count: number
    unread_notifications_count: number
  }
  workspaces: {
    id: string
    name: string
    description?: string | null
    workspace_type: string
    created_at: string
  }[]
  connected_repositories: {
    id: string
    workspace_id: string
    owner: string
    repo_name: string
    github_url: string
    default_branch: string
    is_private: boolean
    status: string
    last_synced_at?: string | null
  }[]
  recent_analyses: {
    id: string
    owner: string
    repo_name: string
    status: string
    created_at: string
    metrics: Record<string, any>
  }[]
  recent_pr_analyses: {
    id: string
    repo_owner: string
    repo_name: string
    pr_number: number
    pr_title: string
    review_priority: string
    changed_files_count: number
    additions: number
    deletions: number
    created_at: string
  }[]
  recent_assessments: {
    id: string
    analysis_id: string
    participant_name?: string | null
    assessment_type: string
    status: string
    score?: number | null
    created_at: string
  }[]
  usage: {
    workspace_id?: string | null
    total_repo_analyses: number
    total_pr_analyses: number
    total_codevitals_sessions: number
    total_events: number
    current_plan: string
    allowances: Record<string, any>
  }
}

// Auth API
export function getAuthStatus() {
  return request<AuthStatus>('/api/v1/auth/status')
}

export function getLoginUrl(redirectUrl?: string) {
  const path = redirectUrl ? `/api/v1/auth/login-url?redirect_url=${encodeURIComponent(redirectUrl)}` : '/api/v1/auth/login-url'
  return request<{ login_url: string; state: string }>(path)
}

export function submitOAuthCallback(code: string, state: string) {
  return request<{ user: User; expires_at: string; session_token?: string }>('/api/v1/auth/callback', {
    method: 'POST',
    body: JSON.stringify({ code, state }),
  })
}

export function logout() {
  return request<{ message: string }>('/api/v1/auth/logout', { method: 'POST' })
}

// Workspaces API
export function getWorkspaces() {
  return request<Workspace[]>('/api/v1/workspaces')
}

export function createWorkspace(data: { name: string; description?: string; workspace_type?: string }) {
  return request<Workspace>('/api/v1/workspaces', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getWorkspace(id: string) {
  return request<Workspace>(`/api/v1/workspaces/${id}`)
}

export function updateWorkspace(id: string, data: { name?: string; description?: string }) {
  return request<Workspace>(`/api/v1/workspaces/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function getWorkspaceMembers(id: string) {
  return request<WorkspaceMember[]>(`/api/v1/workspaces/${id}/members`)
}

export function createWorkspaceInvitation(id: string, data: { role?: string; target_email?: string; target_github_username?: string; expires_in_days?: number }) {
  return request<WorkspaceInvitation>(`/api/v1/workspaces/${id}/invitations`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function joinWorkspace(invite_token: string) {
  return request<Workspace>('/api/v1/workspaces/join', {
    method: 'POST',
    body: JSON.stringify({ invite_token }),
  })
}

export function changeMemberRole(workspaceId: string, userId: string, role: string) {
  return request<WorkspaceMember>(`/api/v1/workspaces/${workspaceId}/members/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export function removeWorkspaceMember(workspaceId: string, userId: string) {
  return request<{ message: string }>(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
    method: 'DELETE',
  })
}

export function getWorkspaceRepositories(workspaceId: string) {
  return request<ConnectedRepository[]>(`/api/v1/workspaces/${workspaceId}/repositories`)
}

export function connectWorkspaceRepository(workspaceId: string, data: { github_url: string; is_private?: boolean; default_branch?: string }) {
  return request<ConnectedRepository>(`/api/v1/workspaces/${workspaceId}/repositories`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function disconnectWorkspaceRepository(workspaceId: string, repoId: string) {
  return request<{ message: string }>(`/api/v1/workspaces/${workspaceId}/repositories/${repoId}`, {
    method: 'DELETE',
  })
}

export function updateRepoAutomation(workspaceId: string, repoId: string, data: Partial<AutomationSettings>) {
  return request<AutomationSettings>(`/api/v1/workspaces/${workspaceId}/repositories/${repoId}/automation`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// Notifications API
export function getNotifications(limit = 20, unreadOnly = false) {
  return request<NotificationItem[]>(`/api/v1/notifications?limit=${limit}&unread_only=${unreadOnly}`)
}

export function getUnreadNotificationCount() {
  return request<{ unread_count: number }>('/api/v1/notifications/unread-count')
}

export function markNotificationRead(id: string) {
  return request<NotificationItem>(`/api/v1/notifications/${id}/read`, { method: 'PATCH' })
}

export function markAllNotificationsRead() {
  return request<{ message: string }>('/api/v1/notifications/read-all', { method: 'POST' })
}

// Dashboard API
export function getDashboardSummary() {
  return request<DashboardSummary>('/api/v1/dashboard/summary')
}
