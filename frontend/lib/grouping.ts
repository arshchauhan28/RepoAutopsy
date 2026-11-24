import type { Finding } from './api'

export type GroupedOccurrence = {
  id: string
  line?: number | null
  evidence?: string | null
  description?: string | null
  file_path?: string | null
  rule_id?: string | null
  evidence_type?: string | null
  confidence_classification?: string | null
  when_intentional?: string | null
  detection_method?: string | null
}

export type GroupedIssue = {
  id: string
  title: string
  severity: string
  confidence: string
  category: string
  file_path: string | null
  why_it_matters: string
  suggested_fix: string
  root_cause_group: string
  when_intentional?: string | null
  detection_method?: string | null
  occurrences: GroupedOccurrence[]
  occurrenceCount: number
}

export type DiagnosticCounts = {
  distinct: {
    critical: number
    high: number
    medium: number
    low: number
    totalHighPriority: number
    total: number
    security: number
    quality: number
  }
  occurrences: {
    critical: number
    high: number
    medium: number
    low: number
    totalHighPriority: number
    total: number
    security: number
    quality: number
  }
}

export function groupFindings(findings: Finding[]): {
  groupedIssues: GroupedIssue[]
  counts: DiagnosticCounts
} {
  const groupsMap = new Map<string, GroupedIssue>()

  const counts: DiagnosticCounts = {
    distinct: { critical: 0, high: 0, medium: 0, low: 0, totalHighPriority: 0, total: 0, security: 0, quality: 0 },
    occurrences: { critical: 0, high: 0, medium: 0, low: 0, totalHighPriority: 0, total: 0, security: 0, quality: 0 },
  }

  findings.forEach((f, idx) => {
    const s = (f.severity || 'low').toLowerCase()
    const c = (f.category || 'quality').toLowerCase()
    const groupKey = `${f.root_cause_group || f.title}::${f.file_path || 'global'}`

    // Count raw occurrences
    counts.occurrences.total++
    if (c === 'security') {
      counts.occurrences.security++
    } else {
      counts.occurrences.quality++
    }

    if (s === 'critical') {
      counts.occurrences.critical++
      counts.occurrences.totalHighPriority++
    } else if (s === 'high') {
      counts.occurrences.high++
      counts.occurrences.totalHighPriority++
    } else if (s === 'medium') {
      counts.occurrences.medium++
      counts.occurrences.totalHighPriority++
    } else {
      counts.occurrences.low++
    }

    if (!groupsMap.has(groupKey)) {
      // Create new group
      const newGroup: GroupedIssue = {
        id: f.id || `group-${idx}`,
        title: f.title,
        severity: s,
        confidence: f.confidence || 'high',
        category: f.category || 'quality',
        file_path: f.file_path || null,
        why_it_matters: f.why_it_matters || f.description || 'Static analysis pattern detected in source code.',
        suggested_fix: f.suggested_fix || f.recommendation || 'Refactor the flagged pattern following defensive coding best practices.',
        root_cause_group: f.root_cause_group || 'general',
        when_intentional: f.when_intentional || null,
        detection_method: f.detection_method || (f.evidence_type?.includes('ast') ? 'AST-Confirmed Pattern' : 'Heuristic Detection'),
        occurrences: [],
        occurrenceCount: 0,
      }
      groupsMap.set(groupKey, newGroup)

      // Count distinct groups
      counts.distinct.total++
      if (c === 'security') {
        counts.distinct.security++
      } else {
        counts.distinct.quality++
      }

      if (s === 'critical') {
        counts.distinct.critical++
        counts.distinct.totalHighPriority++
      } else if (s === 'high') {
        counts.distinct.high++
        counts.distinct.totalHighPriority++
      } else if (s === 'medium') {
        counts.distinct.medium++
        counts.distinct.totalHighPriority++
      } else {
        counts.distinct.low++
      }
    }

    const group = groupsMap.get(groupKey)!
    group.occurrences.push({
      id: f.id || `occ-${idx}`,
      line: f.line,
      evidence: f.evidence,
      description: f.description,
      file_path: f.file_path,
      rule_id: f.rule_id || null,
      evidence_type: f.evidence_type || null,
      confidence_classification: f.confidence_classification || null,
      when_intentional: f.when_intentional || null,
      detection_method: f.detection_method || null,
    })
    group.occurrenceCount = group.occurrences.length
  })

  // Sort groups by severity: Critical -> High -> Medium -> Low
  const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
    const rankDiff = (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4)
    if (rankDiff !== 0) return rankDiff
    return (a.file_path || '').localeCompare(b.file_path || '')
  })

  return { groupedIssues: sortedGroups, counts }
}

