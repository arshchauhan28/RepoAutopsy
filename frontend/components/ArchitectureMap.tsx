'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import {
  Layers,
  FileCode,
  Folder,
  FolderOpen,
  Share2,
  Maximize2,
  Minimize2,
  Search,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Database,
  Shield,
  Box,
  Code2,
  FileText,
  Radio,
  FileJson,
  X,
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Filter,
  Eye,
  Activity,
  GitCommit,
  Cpu,
  CornerDownRight,
  Sliders,
  ShieldAlert,
} from 'lucide-react'
import type {
  ArchitectureData,
  FileHierarchyNode,
  ComponentSummary,
  DependencyNode,
  Finding,
  GroupedModuleNode,
} from '@/lib/api'

interface ArchitectureMapProps {
  architecture?: ArchitectureData
  owner?: string
  repo?: string
  defaultBranch?: string | null
  findings?: Finding[]
  onSelectFindingCategory?: (category: string) => void
}

// -------------------------------------------------------------
// DAGRE LAYOUT COMPUTATION
// -------------------------------------------------------------
function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction = 'LR',
  nodeWidth = 280,
  nodeHeight = 125,
  nodeSep = 55,
  rankSep = 85
) {
  if (!nodes.length) return { nodes: [], edges: [] }

  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: 35,
    marginy: 35,
  })

  nodes.forEach(node => {
    const w = (node.data as any)?.width || nodeWidth
    const h = (node.data as any)?.height || nodeHeight
    dagreGraph.setNode(node.id, { width: w, height: h })
  })

  edges.forEach(edge => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  const layoutedNodes = nodes.map(node => {
    const nodeWithPosition = dagreGraph.node(node.id) || { x: 0, y: 0 }
    const w = (node.data as any)?.width || nodeWidth
    const h = (node.data as any)?.height || nodeHeight
    return {
      ...node,
      targetPosition: direction === 'LR' ? Position.Left : Position.Top,
      sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - w / 2,
        y: nodeWithPosition.y - h / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

// -------------------------------------------------------------
// LAYER STYLING CONSTANTS
// -------------------------------------------------------------
const LAYER_STYLES: Record<
  string,
  { label: string; color: string; border: string; bg: string; badgeBg: string; edgeColor: string; icon: any }
> = {
  presentation: {
    label: 'Presentation',
    color: 'text-amber-400',
    border: 'border-amber-400/40',
    bg: 'bg-amber-400/10',
    badgeBg: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
    edgeColor: '#f2b84b',
    icon: Layers,
  },
  api: {
    label: 'API & Routing',
    color: 'text-sky-400',
    border: 'border-sky-400/40',
    bg: 'bg-sky-400/10',
    badgeBg: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
    edgeColor: '#38bdf8',
    icon: Radio,
  },
  domain: {
    label: 'Business Logic',
    color: 'text-indigo-400',
    border: 'border-indigo-400/40',
    bg: 'bg-indigo-400/10',
    badgeBg: 'bg-indigo-400/15 text-indigo-300 border-indigo-400/30',
    edgeColor: '#818cf8',
    icon: Cpu,
  },
  data: {
    label: 'Data Storage',
    color: 'text-emerald-400',
    border: 'border-emerald-400/40',
    bg: 'bg-emerald-400/10',
    badgeBg: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
    edgeColor: '#34d399',
    icon: Database,
  },
  security: {
    label: 'Security & Auth',
    color: 'text-rose-400',
    border: 'border-rose-400/40',
    bg: 'bg-rose-400/10',
    badgeBg: 'bg-rose-400/15 text-rose-300 border-rose-400/30',
    edgeColor: '#fb7185',
    icon: Shield,
  },
  integration: {
    label: 'Integrations',
    color: 'text-purple-400',
    border: 'border-purple-400/40',
    bg: 'bg-purple-400/10',
    badgeBg: 'bg-purple-400/15 text-purple-300 border-purple-400/30',
    edgeColor: '#c084fc',
    icon: Share2,
  },
  infrastructure: {
    label: 'Infrastructure',
    color: 'text-orange-400',
    border: 'border-orange-400/40',
    bg: 'bg-orange-400/10',
    badgeBg: 'bg-orange-400/15 text-orange-300 border-orange-400/30',
    edgeColor: '#fb923c',
    icon: Box,
  },
  testing: {
    label: 'Test Suite',
    color: 'text-teal-400',
    border: 'border-teal-400/40',
    bg: 'bg-teal-400/10',
    badgeBg: 'bg-teal-400/15 text-teal-300 border-teal-400/30',
    edgeColor: '#2dd4bf',
    icon: CheckCircle2,
  },
  general: {
    label: 'Documentation',
    color: 'text-slate-400',
    border: 'border-slate-400/40',
    bg: 'bg-slate-400/10',
    badgeBg: 'bg-slate-400/15 text-slate-300 border-slate-400/30',
    edgeColor: '#94a3b8',
    icon: FileText,
  },
}

// -------------------------------------------------------------
// CUSTOM REACT FLOW NODES
// -------------------------------------------------------------

// Architecture Subsystem Node (Level 1)
function ArchitectureComponentNode({ data, selected }: any) {
  const style = LAYER_STYLES[data.layer] || LAYER_STYLES.infrastructure
  const Icon = style.icon

  return (
    <div
      className={`relative w-[280px] rounded-xl border bg-[#111418] p-3.5 shadow-xl transition-all duration-200 cursor-pointer ${
        selected
          ? 'border-amber-400 ring-2 ring-amber-400/30 bg-[#161a20]'
          : 'border-white/[.14] hover:border-amber-400/60 hover:bg-[#14181e]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-[#111418] !bg-amber-400 !-left-1.5"
      />

      {/* Top Header: Icon + Layer Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${style.bg} ${style.color}`}>
          <Icon size={14} />
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold ${style.badgeBg}`}
        >
          {style.label}
        </span>
      </div>

      {/* Subsystem Name */}
      <div className="mt-2 text-xs font-semibold text-white leading-tight">{data.label}</div>

      {/* Concise Responsibility Role */}
      {data.role && (
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#9e9a93]">{data.role}</p>
      )}

      {/* File count & Lines */}
      <div className="mt-2.5 flex items-center justify-between border-t border-white/[.07] pt-2 font-mono text-[10px] text-[#77736c]">
        <span>{data.file_count} files</span>
        <span>{data.total_lines?.toLocaleString()} lines</span>
      </div>

      {/* Technologies chips */}
      {data.technologies && data.technologies.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.technologies.slice(0, 3).map((t: string) => (
            <span
              key={t}
              className="rounded border border-white/[.08] bg-white/[.04] px-1.5 py-0.5 font-mono text-[9px] text-[#c4c0b8]"
            >
              {t}
            </span>
          ))}
          {data.technologies.length > 3 && (
            <span className="font-mono text-[9px] text-[#77736c]">+{data.technologies.length - 3}</span>
          )}
        </div>
      )}

      {/* Card Action Hint */}
      <div className="mt-2.5 flex items-center justify-end text-[10px] font-medium text-amber-400/90 gap-1 hover:text-amber-300">
        <span>Inspect Subsystem</span>
        <ArrowRight size={11} />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-[#111418] !bg-amber-400 !-right-1.5"
      />
    </div>
  )
}

// Mode 1: Grouped Module Node
function GroupedModuleCardNode({ data, selected }: any) {
  return (
    <div
      className={`relative w-[250px] rounded-xl border bg-[#111418] p-3 shadow-lg transition-all duration-200 cursor-pointer ${
        selected
          ? 'border-amber-400 ring-2 ring-amber-400/30 bg-[#161a20]'
          : 'border-white/[.14] hover:border-amber-400/60 hover:bg-[#14181e]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-[#111418] !bg-sky-400 !-left-1.5"
      />

      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 truncate">
          <Folder size={14} className="text-amber-400 shrink-0" />
          <span className="truncate text-xs font-semibold text-white">{data.label}</span>
        </div>
        <span className="rounded bg-sky-400/10 px-1.5 py-0.5 font-mono text-[9px] text-sky-300 shrink-0">
          {data.module_count} modules
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[#8e8a82]">
        <span>{data.lines?.toLocaleString()} lines</span>
        <span>
          {data.in_degree || 0} in / {data.out_degree || 0} out
        </span>
      </div>

      {data.external_packages && data.external_packages.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-white/[.06] pt-1.5">
          {data.external_packages.slice(0, 3).map((pkg: string) => (
            <span key={pkg} className="rounded bg-white/[.04] px-1.5 py-0.2 font-mono text-[9px] text-[#a8a49c]">
              {pkg}
            </span>
          ))}
          {data.external_packages.length > 3 && (
            <span className="font-mono text-[9px] text-[#6d6962]">+{data.external_packages.length - 3}</span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[10px] text-amber-400/90 font-medium pt-1">
        <span>Click to inspect</span>
        <ArrowRight size={10} />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-[#111418] !bg-sky-400 !-right-1.5"
      />
    </div>
  )
}

// Mode 2: Detailed Internal Dependency Module Node
function DependencyModuleNode({ data, selected }: any) {
  const isExt = data.type === 'external'
  const isCirc = data.is_circular
  const isDimmed = data.is_dimmed
  const isFocused = data.is_focused

  return (
    <div
      style={{ opacity: isDimmed ? 0.2 : 1 }}
      className={`relative min-w-[210px] max-w-[260px] rounded-lg border p-2.5 shadow transition-all duration-200 cursor-pointer ${
        isCirc
          ? 'border-rose-500 bg-rose-950/30 ring-2 ring-rose-500/40 text-rose-100'
          : isFocused
          ? 'border-amber-400 bg-[#1a1f26] ring-2 ring-amber-400/40'
          : selected
          ? 'border-amber-400 bg-[#161a20] ring-2 ring-amber-400/30'
          : isExt
          ? 'border-indigo-500/40 bg-indigo-950/20'
          : 'border-white/[.14] bg-[#111418] hover:border-white/[.35]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={`!h-2 !w-2 !border-[#111418] ${isCirc ? '!bg-rose-400' : '!bg-amber-400'}`}
      />

      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 truncate">
          {isExt ? (
            <Box size={13} className="shrink-0 text-indigo-400" />
          ) : (
            <Code2 size={13} className={isCirc ? 'shrink-0 text-rose-400' : 'shrink-0 text-amber-400'} />
          )}
          <span className="truncate text-xs font-semibold text-white">{data.label}</span>
        </div>
        {isCirc && (
          <span className="flex items-center gap-0.5 rounded bg-rose-500/20 px-1 py-0.2 font-mono text-[9px] font-bold text-rose-300 shrink-0">
            <AlertTriangle size={9} /> CYCLE
          </span>
        )}
      </div>

      <div className="mt-1 truncate font-mono text-[9px] text-[#77736c]">{data.path}</div>

      <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] text-[#8e8a82] border-t border-white/[.06] pt-1">
        <span>{isExt ? 'External' : `${data.lines || 0} lines`}</span>
        <span>
          {data.in_degree || 0} in / {data.out_degree || 0} out
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className={`!h-2 !w-2 !border-[#111418] ${isCirc ? '!bg-rose-400' : '!bg-amber-400'}`}
      />
    </div>
  )
}

// Mode 3: External Package Node
function ExternalPackageCardNode({ data, selected }: any) {
  return (
    <div
      className={`relative min-w-[200px] max-w-[240px] rounded-xl border bg-[#111418] p-3 shadow-lg transition-all duration-200 cursor-pointer ${
        selected
          ? 'border-indigo-400 ring-2 ring-indigo-400/30 bg-[#151924]'
          : 'border-indigo-500/30 hover:border-indigo-400/60 bg-[#111418]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-[#111418] !bg-indigo-400 !-left-1.5"
      />

      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-indigo-500/20 text-indigo-300">
          <Box size={13} />
        </div>
        <div className="truncate text-xs font-semibold text-white">{data.label}</div>
      </div>

      <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-indigo-300/80 border-t border-white/[.06] pt-1.5">
        <span>External Dependency</span>
        <span className="font-semibold text-white">{data.usage_count} uses</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-[#111418] !bg-indigo-400 !-right-1.5"
      />
    </div>
  )
}

const nodeTypes = {
  componentNode: ArchitectureComponentNode,
  groupedModuleNode: GroupedModuleCardNode,
  dependencyNode: DependencyModuleNode,
  externalPackageNode: ExternalPackageCardNode,
}

// -------------------------------------------------------------
// CUSTOM FLOATING GRAPH CONTROLS (PHASE 8)
// -------------------------------------------------------------
interface FloatingControlsProps {
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

function FloatingGraphControls({ isFullscreen, onToggleFullscreen }: FloatingControlsProps) {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow()

  return (
    <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-xl border border-white/[.18] bg-[#15181d]/95 p-1.5 shadow-2xl backdrop-blur-md">
      <button
        onClick={() => zoomIn({ duration: 250 })}
        className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-[#d1cdca] transition hover:bg-white/[.08] hover:text-amber-400 active:scale-95"
        title="Zoom In (+)"
        aria-label="Zoom In"
      >
        <ZoomIn size={16} />
      </button>

      <button
        onClick={() => zoomOut({ duration: 250 })}
        className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-[#d1cdca] transition hover:bg-white/[.08] hover:text-amber-400 active:scale-95"
        title="Zoom Out (−)"
        aria-label="Zoom Out"
      >
        <ZoomOut size={16} />
      </button>

      <div className="h-4 w-[1px] bg-white/[.15]" />

      <button
        onClick={() => fitView({ padding: 0.15, duration: 300 })}
        className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-[#d1cdca] transition hover:bg-white/[.08] hover:text-amber-400 active:scale-95"
        title="Fit View"
        aria-label="Fit View"
      >
        <Maximize size={15} />
      </button>

      <button
        onClick={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 })}
        className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-[#d1cdca] transition hover:bg-white/[.08] hover:text-amber-400 active:scale-95"
        title="Reset View (100%)"
        aria-label="Reset View"
      >
        <RotateCcw size={15} />
      </button>

      <div className="h-4 w-[1px] bg-white/[.15]" />

      <button
        onClick={onToggleFullscreen}
        className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg transition active:scale-95 ${
          isFullscreen
            ? 'bg-amber-400 font-bold text-black'
            : 'text-[#d1cdca] hover:bg-white/[.08] hover:text-amber-400'
        }`}
        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  )
}

// -------------------------------------------------------------
// MAIN ARCHITECTURE MAP EXPORT
// -------------------------------------------------------------
export function ArchitectureMap(props: ArchitectureMapProps) {
  return (
    <ReactFlowProvider>
      <ArchitectureMapContent {...props} />
    </ReactFlowProvider>
  )
}

function ArchitectureMapContent({
  architecture,
  owner,
  repo,
  defaultBranch = 'main',
  findings = [],
  onSelectFindingCategory,
}: ArchitectureMapProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'dependencies'>('overview')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Level 2 Drill-down state
  const [selectedComponent, setSelectedComponent] = useState<ComponentSummary | any | null>(null)
  const [componentFileSearch, setComponentFileSearch] = useState('')

  // Dependency Explorer modes
  const [depMode, setDepMode] = useState<'grouped' | 'internal' | 'external'>('grouped')
  const [selectedGroup, setSelectedGroup] = useState<GroupedModuleNode | any | null>(null)
  const [selectedFileModule, setSelectedFileModule] = useState<DependencyNode | any | null>(null)

  // Focus Mode state (Phase 5)
  const [focusedModuleId, setFocusedModuleId] = useState<string | null>(null)
  const [focusDirection, setFocusDirection] = useState<'both' | 'out' | 'in'>('both')
  const [focusDepth, setFocusDepth] = useState<1 | 2 | 99>(1)

  // Circular Dependency selected cycle filter
  const [selectedCycleIndex, setSelectedCycleIndex] = useState<number | null>(null)

  // Layer filter in Overview
  const [layerFilter, setLayerFilter] = useState<string>('all')

  // Mobile layout switch (Phase 10): Visual Graph vs Touch Explorer List
  const [mobileViewType, setMobileViewType] = useState<'graph' | 'list'>('graph')

  // Close drawers on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedComponent(null)
        setSelectedFileModule(null)
        setSelectedGroup(null)
        setFocusedModuleId(null)
        setSelectedCycleIndex(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const coverage = architecture?.coverage
  const circularCycles = architecture?.dependency_graph?.circular_dependencies || []
  const externalPackages = architecture?.dependency_graph?.external_packages || []

  // GitHub Link helper
  const makeGithubLink = (path?: string) => {
    if (!path || !owner || !repo) return null
    return `https://github.com/${owner}/${repo}/blob/${defaultBranch}/${path}`
  }

  // -------------------------------------------------------------
  // TAB 1: ARCHITECTURE OVERVIEW (PHASE 3)
  // -------------------------------------------------------------
  const { nodes: overviewNodes, edges: overviewEdges } = useMemo(() => {
    const rawNodes = architecture?.overview_nodes || []
    const rawEdges = architecture?.overview_edges || []

    if (!rawNodes.length) {
      // Fallback
      return { nodes: [] as Node[], edges: [] as Edge[] }
    }

    // Filter by layer
    let filtered = rawNodes
    if (layerFilter !== 'all') {
      filtered = filtered.filter(n => n.layer === layerFilter)
    }

    // Filter by omnibar search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        n =>
          n.label?.toLowerCase().includes(q) ||
          n.role?.toLowerCase().includes(q) ||
          (n.technologies || []).some((t: string) => t.toLowerCase().includes(q))
      )
    }

    const visibleIds = new Set(filtered.map(n => n.id))

    const rfNodes: Node[] = filtered.map(n => ({
      id: n.id,
      type: 'componentNode',
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        layer: n.layer,
        role: n.role,
        file_count: n.file_count,
        total_lines: n.total_lines,
        technologies: n.technologies,
        sample_files: n.sample_files,
        width: 280,
        height: 125,
      },
    }))

    const rfEdges: Edge[] = rawEdges
      .filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        type: 'smoothstep',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: '#f2b84b',
        },
        style: { stroke: '#f2b84b', strokeWidth: 1.8, opacity: 0.75 },
      }))

    return getLayoutedElements(rfNodes, rfEdges, 'LR', 280, 125, 60, 95)
  }, [architecture, layerFilter, searchQuery])

  // -------------------------------------------------------------
  // TAB 3: DEPENDENCY GRAPH & MODES (PHASE 4, 5, 6, 7)
  // -------------------------------------------------------------

  // Compute or extract Grouped Modules (Mode 1)
  const groupedModulesData = useMemo(() => {
    // 1. If backend already computed grouped_modules, use it
    if (architecture?.dependency_graph?.grouped_modules) {
      return architecture.dependency_graph.grouped_modules
    }

    // 2. Client-side fallback computation for backward compatibility
    const depData = architecture?.dependency_graph
    if (!depData || !depData.nodes) return { groups: [], edges: [] }

    const groupsMap: Record<string, GroupedModuleNode> = {}
    const fileToGroup: Record<string, string> = {}

    const internalNodes = depData.nodes.filter(n => n.type === 'internal')

    internalNodes.forEach(n => {
      const parts = n.path.split('/')
      let groupName = 'root'
      if (parts.length >= 3 && ['backend', 'frontend', 'src'].includes(parts[0])) {
        groupName = `${parts[0]}/${parts[1]}`
        if (parts[1] === 'app' && parts.length >= 4) {
          groupName = `${parts[0]}/${parts[1]}/${parts[2]}`
        }
      } else if (parts.length >= 2) {
        groupName = `${parts[0]}/${parts[1]}`
      }

      fileToGroup[n.path] = groupName

      if (!groupsMap[groupName]) {
        groupsMap[groupName] = {
          id: `grp:${groupName}`,
          label: groupName,
          path: groupName,
          module_count: 0,
          lines: 0,
          modules: [],
          external_packages: [],
          in_degree: 0,
          out_degree: 0,
        }
      }

      groupsMap[groupName].module_count += 1
      groupsMap[groupName].lines += n.lines || 0
      groupsMap[groupName].modules.push(n.path)
    })

    // Group edges
    const groupEdgeWeights: Record<string, number> = {}
    ;(depData.edges || []).forEach(e => {
      if (e.is_external) return
      const gSrc = fileToGroup[e.source]
      const gTgt = fileToGroup[e.target]
      if (gSrc && gTgt && gSrc !== gTgt) {
        const key = `${gSrc}-->${gTgt}`
        groupEdgeWeights[key] = (groupEdgeWeights[key] || 0) + 1
        if (groupsMap[gSrc]) groupsMap[gSrc].out_degree += 1
        if (groupsMap[gTgt]) groupsMap[gTgt].in_degree += 1
      }
    })

    const grpEdges = Object.entries(groupEdgeWeights).map(([key, weight], idx) => {
      const [src, tgt] = key.split('-->')
      return {
        id: `grp_e_${idx}`,
        source: `grp:${src}`,
        target: `grp:${tgt}`,
        weight,
        label: `${weight} links`,
      }
    })

    return {
      groups: Object.values(groupsMap).sort((a, b) => b.module_count - a.module_count),
      edges: grpEdges,
    }
  }, [architecture])

  // Focus Mode traversal set
  const focusSet = useMemo(() => {
    if (!focusedModuleId || !architecture?.dependency_graph) return null

    const edges = architecture.dependency_graph.edges || []
    const connectedNodeIds = new Set<string>([focusedModuleId])
    const connectedEdgeIds = new Set<string>()

    // Traverse BFS
    let currentHopNodes = new Set<string>([focusedModuleId])
    for (let hop = 0; hop < focusDepth; hop++) {
      const nextHopNodes = new Set<string>()

      edges.forEach(e => {
        const isOut = (focusDirection === 'both' || focusDirection === 'out') && currentHopNodes.has(e.source)
        const isIn = (focusDirection === 'both' || focusDirection === 'in') && currentHopNodes.has(e.target)

        if (isOut) {
          connectedNodeIds.add(e.target)
          connectedEdgeIds.add(e.id)
          nextHopNodes.add(e.target)
        }
        if (isIn) {
          connectedNodeIds.add(e.source)
          connectedEdgeIds.add(e.id)
          nextHopNodes.add(e.source)
        }
      })

      if (nextHopNodes.size === 0) break
      currentHopNodes = nextHopNodes
    }

    return { nodes: connectedNodeIds, edges: connectedEdgeIds }
  }, [focusedModuleId, focusDirection, focusDepth, architecture])

  // Circular Dependency selected cycle set
  const activeCycleSet = useMemo(() => {
    if (selectedCycleIndex === null || !circularCycles[selectedCycleIndex]) return null
    const cycle = circularCycles[selectedCycleIndex]
    return new Set(cycle)
  }, [selectedCycleIndex, circularCycles])

  // Mode-dependent nodes & edges for Dependency tab
  const { nodes: depNodes, edges: depEdges } = useMemo(() => {
    const depData = architecture?.dependency_graph
    if (!depData) return { nodes: [] as Node[], edges: [] as Edge[] }

    // =========================================================
    // MODE 1: MODULE OVERVIEW (Grouped)
    // =========================================================
    if (depMode === 'grouped') {
      let groups = groupedModulesData.groups

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        groups = groups.filter(g => g.label.toLowerCase().includes(q) || g.modules.some(m => m.toLowerCase().includes(q)))
      }

      const visibleGroupIds = new Set(groups.map(g => g.id))

      const rfNodes: Node[] = groups.map(g => ({
        id: g.id,
        type: 'groupedModuleNode',
        position: { x: 0, y: 0 },
        data: {
          ...g,
          width: 250,
          height: 110,
        },
      }))

      const rfEdges: Edge[] = groupedModulesData.edges
        .filter(e => visibleGroupIds.has(e.source) && visibleGroupIds.has(e.target))
        .map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: '#38bdf8',
          },
          style: { stroke: '#38bdf8', strokeWidth: 1.8, opacity: 0.75 },
        }))

      return getLayoutedElements(rfNodes, rfEdges, 'LR', 250, 110, 55, 90)
    }

    // =========================================================
    // MODE 3: EXTERNAL PACKAGES
    // =========================================================
    if (depMode === 'external') {
      let extPkgs = externalPackages
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        extPkgs = extPkgs.filter(p => p.package.toLowerCase().includes(q))
      }

      const topPkgs = extPkgs.slice(0, 36)
      const rfNodes: Node[] = topPkgs.map(p => ({
        id: `ext:${p.package}`,
        type: 'externalPackageNode',
        position: { x: 0, y: 0 },
        data: {
          label: p.package,
          usage_count: p.usage_count,
          width: 210,
          height: 80,
        },
      }))

      // External consumer edges
      const pkgIds = new Set(topPkgs.map(p => `ext:${p.package}`))
      const extEdges: Edge[] = (depData.edges || [])
        .filter(e => e.is_external && pkgIds.has(e.target))
        .slice(0, 80)
        .map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'smoothstep',
          style: { stroke: '#818cf8', strokeWidth: 1.2, opacity: 0.4 },
        }))

      return getLayoutedElements(rfNodes, extEdges, 'LR', 210, 80, 50, 80)
    }

    // =========================================================
    // MODE 2: INTERNAL DEPENDENCIES (DAG)
    // =========================================================
    let internalNodes = (depData.nodes || []).filter(n => n.type === 'internal')

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      internalNodes = internalNodes.filter(n => n.label.toLowerCase().includes(q) || n.path.toLowerCase().includes(q))
    }

    // Filter by cycle if cycle selected
    if (activeCycleSet) {
      internalNodes = internalNodes.filter(n => activeCycleSet.has(n.path))
    }

    // Safety limit to guarantee smooth 60fps canvas performance
    const maxNodes = 100
    const displayedNodes = internalNodes.slice(0, maxNodes)
    const visibleIds = new Set(displayedNodes.map(n => n.id))

    const rfNodes: Node[] = displayedNodes.map(n => {
      const isDimmed = focusSet ? !focusSet.nodes.has(n.id) : false
      const isFocused = focusedModuleId === n.id

      return {
        id: n.id,
        type: 'dependencyNode',
        position: { x: 0, y: 0 },
        data: {
          label: n.label,
          path: n.path,
          type: n.type,
          lines: n.lines,
          is_circular: n.is_circular,
          in_degree: n.in_degree,
          out_degree: n.out_degree,
          is_dimmed: isDimmed,
          is_focused: isFocused,
          width: 220,
          height: 80,
        },
      }
    })

    const rfEdges: Edge[] = (depData.edges || [])
      .filter(e => !e.is_external && visibleIds.has(e.source) && visibleIds.has(e.target))
      .map(e => {
        const isCycleEdge = activeCycleSet
          ? activeCycleSet.has(e.source) && activeCycleSet.has(e.target)
          : e.is_circular

        const isHighlightedByFocus = focusSet ? focusSet.edges.has(e.id) : false
        const isDimmed = focusSet ? !isHighlightedByFocus : false

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'smoothstep',
          animated: isCycleEdge,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 12,
            height: 12,
            color: isCycleEdge ? '#f43f5e' : isHighlightedByFocus ? '#f2b84b' : '#64748b',
          },
          style: {
            stroke: isCycleEdge ? '#f43f5e' : isHighlightedByFocus ? '#f2b84b' : '#64748b',
            strokeWidth: isCycleEdge ? 2.2 : isHighlightedByFocus ? 2 : 1.2,
            opacity: isDimmed ? 0.08 : isHighlightedByFocus ? 1 : 0.6,
          },
        }
      })

    return getLayoutedElements(rfNodes, rfEdges, 'LR', 220, 80, 50, 90)
  }, [
    architecture,
    depMode,
    groupedModulesData,
    externalPackages,
    searchQuery,
    focusSet,
    focusedModuleId,
    activeCycleSet,
  ])

  // -------------------------------------------------------------
  // REVERSE DEPENDENCY CLOSURE (POTENTIAL IMPACT ANALYSIS)
  // -------------------------------------------------------------
  const potentialImpact = useMemo(() => {
    if (!selectedFileModule || !architecture?.dependency_graph) return null

    const edges = architecture.dependency_graph.edges || []
    const startPath = selectedFileModule.path

    // Direct reverse dependents
    const directDependents = edges.filter(e => e.target === startPath).map(e => e.source)

    // Full transitive closure BFS
    const visited = new Set<string>()
    const queue = [...directDependents]

    while (queue.length > 0) {
      const curr = queue.shift()!
      if (!visited.has(curr) && curr !== startPath) {
        visited.add(curr)
        edges.forEach(e => {
          if (e.target === curr && !visited.has(e.source)) {
            queue.push(e.source)
          }
        })
      }
    }

    const totalImpactCount = visited.size
    let severity: 'high' | 'medium' | 'low' | 'leaf' = 'leaf'
    if (totalImpactCount >= 5) severity = 'high'
    else if (totalImpactCount >= 2) severity = 'medium'
    else if (totalImpactCount === 1) severity = 'low'

    return {
      directDependents,
      transitiveImpact: Array.from(visited),
      totalImpactCount,
      severity,
    }
  }, [selectedFileModule, architecture])

  // -------------------------------------------------------------
  // NODE CLICK HANDLERS
  // -------------------------------------------------------------
  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      if (activeTab === 'overview') {
        const comp = (architecture?.components || []).find(c => c.id === node.id)
        setSelectedComponent(comp || node.data)
      } else if (activeTab === 'dependencies') {
        if (depMode === 'grouped') {
          const grp = groupedModulesData.groups.find(g => g.id === node.id)
          setSelectedGroup(grp || node.data)
        } else if (depMode === 'internal') {
          const mod = (architecture?.dependency_graph?.nodes || []).find(n => n.id === node.id)
          setSelectedFileModule(mod || node.data)
          setFocusedModuleId(node.id)
        } else if (depMode === 'external') {
          // Find external package details
          const pkgName = node.id.replace('ext:', '')
          const consumers = (architecture?.dependency_graph?.edges || [])
            .filter(e => e.target === node.id)
            .map(e => e.source)
          setSelectedFileModule({
            label: pkgName,
            path: node.id,
            type: 'external',
            consumers,
          })
        }
      }
    },
    [activeTab, depMode, architecture, groupedModulesData]
  )

  // Subsystem Findings matching Level 2 Drill-down
  const componentFindings = useMemo(() => {
    if (!selectedComponent || !findings.length) return []
    const compFiles = new Set(
      (selectedComponent.files || selectedComponent.sample_files || []).map((f: any) =>
        typeof f === 'string' ? f : f.path
      )
    )

    return findings.filter(f => f.file_path && compFiles.has(f.file_path))
  }, [selectedComponent, findings])

  // Filter component files inside Level 2 Drill-down
  const filteredComponentFiles = useMemo(() => {
    if (!selectedComponent) return []
    const allFiles = selectedComponent.files || selectedComponent.sample_files || []
    if (!componentFileSearch.trim()) return allFiles
    const q = componentFileSearch.toLowerCase()
    return allFiles.filter((f: any) => {
      const pathStr = typeof f === 'string' ? f : f.path
      return pathStr.toLowerCase().includes(q)
    })
  }, [selectedComponent, componentFileSearch])

  return (
    <div
      className={`card relative overflow-hidden transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-50 m-0 h-screen w-screen rounded-none border-none bg-[#090a0c]'
          : 'h-[500px] sm:h-[600px] lg:h-[660px]'
      }`}
    >
      {/* ========================================================= */}
      {/* TOP TOOLBAR: TABS + SEARCH + MOBILE TOGGLE */}
      {/* ========================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.1] bg-[#0c0f13] px-3.5 py-2.5">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-white/[.08] bg-black/40 p-1 no-scrollbar">
          <button
            onClick={() => {
              setActiveTab('overview')
              setSelectedComponent(null)
              setSelectedFileModule(null)
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition shrink-0 ${
              activeTab === 'overview'
                ? 'bg-amber-400 font-bold text-black shadow-sm'
                : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
            }`}
          >
            <Layers size={13} />
            <span>Architecture Overview</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('files')
              setSelectedComponent(null)
              setSelectedFileModule(null)
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition shrink-0 ${
              activeTab === 'files'
                ? 'bg-amber-400 font-bold text-black shadow-sm'
                : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
            }`}
          >
            <Folder size={13} />
            <span>File Explorer</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('dependencies')
              setSelectedComponent(null)
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition shrink-0 ${
              activeTab === 'dependencies'
                ? 'bg-amber-400 font-bold text-black shadow-sm'
                : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
            }`}
          >
            <Share2 size={13} />
            <span>Dependency Explorer</span>
          </button>
        </div>

        {/* Right Actions: Mobile Toggle, Search Omnibar, Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Mobile View Toggle (Card List vs Canvas) */}
          <div className="flex sm:hidden items-center rounded border border-white/[.1] bg-black/30 p-0.5">
            <button
              onClick={() => setMobileViewType('graph')}
              className={`px-2 py-1 text-[11px] rounded ${
                mobileViewType === 'graph' ? 'bg-amber-400 font-bold text-black' : 'text-[#aaa69e]'
              }`}
            >
              Canvas
            </button>
            <button
              onClick={() => setMobileViewType('list')}
              className={`px-2 py-1 text-[11px] rounded ${
                mobileViewType === 'list' ? 'bg-amber-400 font-bold text-black' : 'text-[#aaa69e]'
              }`}
            >
              List
            </button>
          </div>

          {/* Omnibar Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#77736c]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'files'
                  ? 'Filter files...'
                  : activeTab === 'dependencies'
                  ? 'Search modules...'
                  : 'Search subsystems...'
              }
              className="w-32 sm:w-44 rounded-lg border border-white/[.12] bg-black/40 py-1 pl-7 pr-2.5 text-xs text-white placeholder:text-[#55514b] focus:w-48 sm:focus:w-56 focus:border-amber-400 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#77736c] hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECONDARY SUB-TOOLBAR (MODES, FILTERS & FOCUS BAR) */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="flex items-center justify-between gap-2 border-b border-white/[.06] bg-[#090b0e] px-4 py-2 text-xs">
          {/* Layer Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="font-mono text-[10px] uppercase text-[#77736c] shrink-0">Layer:</span>
            {['all', 'presentation', 'api', 'domain', 'data', 'security', 'infrastructure', 'testing'].map(l => (
              <button
                key={l}
                onClick={() => setLayerFilter(l)}
                className={`rounded px-2 py-0.5 font-mono text-[10px] capitalize transition shrink-0 ${
                  layerFilter === l
                    ? 'border border-amber-400/40 bg-amber-400/15 text-amber-300 font-semibold'
                    : 'text-[#8e8a82] hover:bg-white/[.04] hover:text-white'
                }`}
              >
                {l === 'all' ? 'All Subsystems' : l}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-2 font-mono text-[10px] text-[#77736c]">
            <span>Tip: Click any subsystem card to drill down</span>
          </div>
        </div>
      )}

      {activeTab === 'dependencies' && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.06] bg-[#090b0e] px-3.5 py-2 text-xs">
          {/* Mode Switcher: Mode 1 / Mode 2 / Mode 3 */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => {
                setDepMode('grouped')
                setSelectedFileModule(null)
                setFocusedModuleId(null)
                setSelectedCycleIndex(null)
              }}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition shrink-0 ${
                depMode === 'grouped'
                  ? 'border border-sky-400/40 bg-sky-400/15 text-sky-300'
                  : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
              }`}
            >
              <Folder size={12} />
              <span>Mode 1: Module Overview</span>
            </button>

            <button
              onClick={() => {
                setDepMode('internal')
                setSelectedGroup(null)
              }}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition shrink-0 ${
                depMode === 'internal'
                  ? 'border border-amber-400/40 bg-amber-400/15 text-amber-300'
                  : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
              }`}
            >
              <Code2 size={12} />
              <span>Mode 2: Internal Dependencies</span>
            </button>

            <button
              onClick={() => {
                setDepMode('external')
                setSelectedGroup(null)
                setSelectedFileModule(null)
                setFocusedModuleId(null)
              }}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition shrink-0 ${
                depMode === 'external'
                  ? 'border border-indigo-400/40 bg-indigo-400/15 text-indigo-300'
                  : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
              }`}
            >
              <Box size={12} />
              <span>Mode 3: External Packages ({externalPackages.length})</span>
            </button>

            {/* Circular Cycle Highlighter Button */}
            {circularCycles.length > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    setDepMode('internal')
                    setSelectedCycleIndex(selectedCycleIndex === null ? 0 : null)
                  }}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition ${
                    selectedCycleIndex !== null
                      ? 'bg-rose-500 font-bold text-white'
                      : 'border border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                  }`}
                  title="Highlight circular dependency cycles"
                >
                  <AlertTriangle size={12} />
                  <span>Cycles ({circularCycles.length})</span>
                </button>
              </div>
            )}
          </div>

          {/* Mode 2 Focus Bar Toolbar when focused */}
          {depMode === 'internal' && focusedModuleId && (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-xs text-amber-300 shrink-0">
              <span className="font-mono text-[10px] uppercase font-bold text-amber-400">Focus:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFocusDirection(d => (d === 'both' ? 'out' : d === 'out' ? 'in' : 'both'))}
                  className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[9px] hover:text-white"
                >
                  Dir: {focusDirection}
                </button>
                <button
                  onClick={() => setFocusDepth(d => (d === 1 ? 2 : d === 2 ? 99 : 1))}
                  className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[9px] hover:text-white"
                >
                  Depth: {focusDepth === 99 ? 'All' : `${focusDepth} hop`}
                </button>
                <button
                  onClick={() => {
                    setFocusedModuleId(null)
                    setSelectedFileModule(null)
                  }}
                  className="ml-1 text-amber-400 hover:text-white"
                  title="Clear Focus"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cycle Banner if a specific cycle is selected */}
      {activeTab === 'dependencies' && selectedCycleIndex !== null && circularCycles[selectedCycleIndex] && (
        <div className="flex items-center justify-between border-b border-rose-500/30 bg-rose-950/60 px-4 py-1.5 text-xs text-rose-200">
          <div className="flex items-center gap-2 truncate">
            <AlertTriangle size={13} className="text-rose-400 shrink-0" />
            <span className="font-bold">
              Cycle #{selectedCycleIndex + 1} of {circularCycles.length}:
            </span>
            <span className="font-mono text-[11px] truncate text-rose-200">
              {circularCycles[selectedCycleIndex].map(p => p.split('/').pop()).join(' → ')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {circularCycles.length > 1 && (
              <button
                onClick={() => setSelectedCycleIndex((selectedCycleIndex + 1) % circularCycles.length)}
                className="rounded border border-rose-400/30 bg-rose-500/20 px-2 py-0.5 text-[10px] text-white hover:bg-rose-500/30"
              >
                Next Cycle
              </button>
            )}
            <button
              onClick={() => setSelectedCycleIndex(null)}
              className="rounded p-0.5 text-rose-300 hover:text-white"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW CONTENT CONTAINER */}
      {/* ========================================================= */}
      <div className="relative h-[calc(100%-80px)] w-full overflow-hidden">
        {/* ========================================================= */}
        {/* TAB 1: ARCHITECTURE OVERVIEW CANVAS & LEVEL 2 DRILL-DOWN */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div className="relative h-full w-full">
            {/* Visual Canvas (or Mobile List view) */}
            {mobileViewType === 'graph' ? (
              <ReactFlow
                nodes={overviewNodes}
                edges={overviewEdges}
                nodeTypes={nodeTypes}
                onNodeClick={onNodeClick}
                fitView
                minZoom={0.2}
                maxZoom={1.6}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#1c2026" gap={24} size={1} />
                <FloatingGraphControls
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                />
              </ReactFlow>
            ) : (
              /* Mobile Touch Explorer: Card List */
              <div className="h-full overflow-y-auto p-4 space-y-3">
                <div className="text-xs text-[#8e8a82] font-mono uppercase">
                  Subsystems ({overviewNodes.length}) — Tap to inspect
                </div>
                {overviewNodes.map(node => {
                  const d = node.data as any
                  return (
                    <div
                      key={node.id}
                      onClick={() => onNodeClick(null, node)}
                      className="card p-3.5 border border-white/[.12] hover:border-amber-400 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-sm">{d.label}</span>
                        <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded bg-white/[.05] text-amber-300 border border-amber-400/30">
                          {d.layer}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#aaa69e] line-clamp-2">{d.role}</p>
                      <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[#77736c]">
                        <span>{d.file_count} files</span>
                        <span>{d.total_lines?.toLocaleString()} lines</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* LEVEL 2: COMPONENT DRILL-DOWN PANEL (DESKTOP OVERLAY / MOBILE BOTTOM SHEET) */}
            {selectedComponent && (
              <div className="absolute inset-y-0 right-0 z-30 w-full sm:w-[440px] md:w-[480px] bg-[#0c0f13]/98 border-l border-white/[.16] shadow-2xl backdrop-blur-xl flex flex-col justify-between animate-slide-in-right">
                <div className="flex-1 overflow-y-auto p-5">
                  {/* Breadcrumb Navigation Header */}
                  <div className="flex items-center justify-between border-b border-white/[.08] pb-3.5">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#8e8a82]">
                      <span>Anatomy</span>
                      <ChevronRight size={12} />
                      <button
                        onClick={() => setSelectedComponent(null)}
                        className="text-amber-400 hover:underline"
                      >
                        System Overview
                      </button>
                      <ChevronRight size={12} />
                      <span className="text-white truncate max-w-[120px]">
                        {selectedComponent.name || selectedComponent.label}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedComponent(null)}
                      className="rounded-lg p-1.5 text-[#8e8a82] hover:bg-white/[.06] hover:text-white"
                      title="Back to System Overview (Esc)"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Component Title & Layer Badge */}
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-white leading-tight">
                        {selectedComponent.name || selectedComponent.label}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#aaa69e]">{selectedComponent.role}</p>
                    </div>
                    {selectedComponent.layer && (
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] uppercase font-bold text-amber-300 shrink-0">
                        {selectedComponent.layer}
                      </span>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/[.08] bg-white/[.02] p-3 text-xs">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">Files</div>
                      <div className="mt-0.5 font-mono text-base font-bold text-white">
                        {selectedComponent.file_count}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">
                        Maintainable Code Lines
                      </div>
                      <div className="mt-0.5 font-mono text-base font-bold text-white">
                        {selectedComponent.total_lines?.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Technologies */}
                  {selectedComponent.technologies && selectedComponent.technologies.length > 0 && (
                    <div className="mt-4">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-[#77736c]">
                        Detected Technologies
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {selectedComponent.technologies.map((t: string) => (
                          <span
                            key={t}
                            className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-medium text-amber-300"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Incoming & Outgoing Relationships */}
                  {(selectedComponent.incoming_connections?.length > 0 ||
                    selectedComponent.outgoing_connections?.length > 0) && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-white/[.06] bg-black/30 p-2.5">
                        <div className="font-mono text-[9px] uppercase text-[#77736c]">Inbound Callers</div>
                        <div className="mt-1 font-semibold text-white">
                          {selectedComponent.incoming_connections?.length || 0} subsystems
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/[.06] bg-black/30 p-2.5">
                        <div className="font-mono text-[9px] uppercase text-[#77736c]">Outbound Calls</div>
                        <div className="mt-1 font-semibold text-white">
                          {selectedComponent.outgoing_connections?.length || 0} subsystems
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Diagnostics Findings in this Subsystem */}
                  {componentFindings.length > 0 && (
                    <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/[.04] p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                          <ShieldAlert size={14} />
                          <span>Diagnostics Findings in this Subsystem ({componentFindings.length})</span>
                        </div>
                        {onSelectFindingCategory && (
                          <button
                            onClick={() => onSelectFindingCategory('all')}
                            className="font-mono text-[10px] text-amber-400 hover:underline"
                          >
                            View in Diagnostics →
                          </button>
                        )}
                      </div>
                      <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {componentFindings.map((f: Finding) => (
                          <div
                            key={f.id}
                            className="rounded border border-white/[.08] bg-black/40 p-2 text-xs flex items-center justify-between gap-2"
                          >
                            <div className="truncate">
                              <span
                                className={`mr-1.5 rounded px-1 py-0.2 font-mono text-[9px] font-bold uppercase ${
                                  f.severity === 'critical'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : f.severity === 'high'
                                    ? 'bg-orange-500/20 text-orange-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {f.severity}
                              </span>
                              <span className="text-[#c8c4bc] font-medium truncate">{f.title}</span>
                            </div>
                            {f.file_path && (
                              <span className="font-mono text-[10px] text-[#77736c] shrink-0">
                                {f.file_path.split('/').pop()}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Component Files List with Search & GitHub Links */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-[#77736c]">
                        Component Files ({filteredComponentFiles.length})
                      </div>
                    </div>

                    <div className="mt-2 relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#77736c]" />
                      <input
                        type="text"
                        value={componentFileSearch}
                        onChange={e => setComponentFileSearch(e.target.value)}
                        placeholder="Filter files in this component..."
                        className="w-full rounded-lg border border-white/[.1] bg-black/40 py-1 pl-7 pr-2.5 text-xs text-white placeholder:text-[#55514b] focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div className="mt-2 max-h-56 overflow-y-auto space-y-1 pr-1">
                      {filteredComponentFiles.map((f: any, idx: number) => {
                        const pathStr = typeof f === 'string' ? f : f.path
                        const lines = typeof f === 'object' ? f.lines : null
                        const link = makeGithubLink(pathStr)
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-2 rounded-lg border border-white/[.06] bg-white/[.02] p-2 text-xs hover:border-white/[.15] transition"
                          >
                            <span className="truncate font-mono text-[11px] text-[#c8c4bc]">{pathStr}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              {lines !== null && (
                                <span className="font-mono text-[10px] text-[#77736c]">{lines} lines</span>
                              )}
                              {link && (
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#8e8a82] hover:text-amber-300"
                                  title="View on GitHub"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Bottom Back Button */}
                <div className="border-t border-white/[.08] bg-[#090b0e] p-3.5 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedComponent(null)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/[.12] bg-white/[.04] px-3.5 py-1.5 text-xs font-semibold text-[#c8c4bc] hover:bg-white/[.08] hover:text-white"
                  >
                    <ArrowLeft size={13} />
                    <span>Back to System Overview</span>
                  </button>
                  <span className="font-mono text-[10px] text-[#6d6962]">Press Esc to close</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: FILE EXPLORER (PRESERVED) */}
        {/* ========================================================= */}
        {activeTab === 'files' && (
          <FileExplorerView
            rootHierarchy={architecture?.file_hierarchy}
            searchQuery={searchQuery}
            owner={owner}
            repo={repo}
            defaultBranch={defaultBranch}
            dependencyGraph={architecture?.dependency_graph}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 3: DEPENDENCY EXPLORER (PHASE 4, 5, 6, 7) */}
        {/* ========================================================= */}
        {activeTab === 'dependencies' && (
          <div className="relative h-full w-full">
            {mobileViewType === 'graph' ? (
              <ReactFlow
                nodes={depNodes}
                edges={depEdges}
                nodeTypes={nodeTypes}
                onNodeClick={onNodeClick}
                fitView
                minZoom={0.15}
                maxZoom={1.6}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#1c2026" gap={24} size={1} />
                <FloatingGraphControls
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                />
              </ReactFlow>
            ) : (
              /* Mobile List for Modules */
              <div className="h-full overflow-y-auto p-4 space-y-2.5">
                <div className="text-xs text-[#8e8a82] font-mono uppercase">
                  {depMode === 'grouped'
                    ? `Package Groups (${groupedModulesData.groups.length})`
                    : depMode === 'external'
                    ? `External Packages (${externalPackages.length})`
                    : `Modules (${depNodes.length})`}
                </div>
                {depNodes.map(node => {
                  const d = node.data as any
                  return (
                    <div
                      key={node.id}
                      onClick={() => onNodeClick(null, node)}
                      className="card p-3 border border-white/[.12] hover:border-amber-400 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-xs truncate">{d.label}</span>
                        <span className="font-mono text-[10px] text-amber-300">
                          {d.in_degree || 0} in / {d.out_degree || 0} out
                        </span>
                      </div>
                      {d.path && (
                        <div className="mt-1 font-mono text-[10px] text-[#77736c] truncate">{d.path}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* GROUP DETAILS DRAWER (FOR MODE 1 GROUPED OVERVIEW) */}
            {selectedGroup && (
              <div className="absolute inset-y-0 right-0 z-30 w-full sm:w-[400px] bg-[#0c0f13]/98 border-l border-white/[.16] shadow-2xl backdrop-blur-xl flex flex-col justify-between animate-slide-in-right">
                <div className="flex-1 overflow-y-auto p-5">
                  <div className="flex items-center justify-between border-b border-white/[.08] pb-3">
                    <div className="flex items-center gap-2">
                      <Folder size={16} className="text-amber-400" />
                      <h3 className="text-sm font-bold text-white truncate">{selectedGroup.label}</h3>
                    </div>
                    <button
                      onClick={() => setSelectedGroup(null)}
                      className="rounded p-1 text-[#8e8a82] hover:text-white"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-white/[.06] bg-white/[.02] p-2.5">
                      <div className="font-mono text-[9px] uppercase text-[#77736c]">Modules</div>
                      <div className="mt-0.5 font-mono text-base font-bold text-white">
                        {selectedGroup.module_count}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/[.06] bg-white/[.02] p-2.5">
                      <div className="font-mono text-[9px] uppercase text-[#77736c]">Total Lines</div>
                      <div className="mt-0.5 font-mono text-base font-bold text-white">
                        {selectedGroup.lines?.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Modules inside this group */}
                  <div className="mt-4">
                    <div className="font-mono text-[10px] uppercase text-[#77736c]">
                      Modules in Group ({selectedGroup.modules?.length || 0})
                    </div>
                    <div className="mt-2 max-h-56 overflow-y-auto space-y-1 pr-1">
                      {(selectedGroup.modules || []).map((m: string) => (
                        <div
                          key={m}
                          onClick={() => {
                            setDepMode('internal')
                            setFocusedModuleId(m)
                            const modObj = (architecture?.dependency_graph?.nodes || []).find(n => n.id === m)
                            if (modObj) setSelectedFileModule(modObj)
                            setSelectedGroup(null)
                          }}
                          className="flex items-center justify-between rounded-lg border border-white/[.06] bg-white/[.02] p-2 text-xs hover:border-amber-400/50 hover:bg-amber-400/5 transition cursor-pointer"
                        >
                          <span className="truncate font-mono text-[11px] text-[#c8c4bc]">{m}</span>
                          <span className="text-amber-400 font-mono text-[10px]">Inspect →</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/[.08] bg-[#090b0e] p-3.5">
                  <button
                    onClick={() => {
                      setDepMode('internal')
                      setSearchQuery(selectedGroup.path)
                      setSelectedGroup(null)
                    }}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400 px-3.5 py-2 text-xs font-bold text-black hover:bg-amber-300"
                  >
                    <span>Explore Internal Dependencies in this Group</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* MODULE INSPECTOR & POTENTIAL IMPACT PANEL (PHASE 6) */}
            {selectedFileModule && (
              <div className="absolute inset-y-0 right-0 z-30 w-full sm:w-[420px] md:w-[450px] bg-[#0c0f13]/98 border-l border-white/[.16] shadow-2xl backdrop-blur-xl flex flex-col justify-between animate-slide-in-right">
                <div className="flex-1 overflow-y-auto p-5">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/[.08] pb-3">
                    <div className="flex items-center gap-2 truncate">
                      <Code2 size={16} className="text-amber-400 shrink-0" />
                      <h3 className="text-sm font-bold text-white truncate">{selectedFileModule.label}</h3>
                    </div>
                    <button
                      onClick={() => setSelectedFileModule(null)}
                      className="rounded p-1 text-[#8e8a82] hover:text-white"
                      title="Close Inspector (Esc)"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="mt-3 rounded border border-white/[.08] bg-black/40 p-2 font-mono text-[11px] text-amber-300 break-all">
                    {selectedFileModule.path}
                  </div>

                  {/* Circular Warning */}
                  {selectedFileModule.is_circular && (
                    <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/40 p-2.5 text-xs text-rose-200">
                      <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                      <span>This module is part of an active circular dependency cycle.</span>
                    </div>
                  )}

                  {/* POTENTIAL IMPACT ANALYSIS (PHASE 6) */}
                  {potentialImpact && (
                    <div className="mt-4 rounded-xl border border-white/[.12] bg-white/[.02] p-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                          <Activity size={14} className="text-amber-400" />
                          <span>Potential Downstream Impact</span>
                        </div>
                        <span
                          className={`rounded px-2 py-0.5 font-mono text-[9px] uppercase font-bold ${
                            potentialImpact.severity === 'high'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : potentialImpact.severity === 'medium'
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                              : potentialImpact.severity === 'low'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {potentialImpact.severity === 'leaf' ? 'Leaf (Safe)' : `${potentialImpact.severity} Impact`}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-[#aaa69e] leading-relaxed">
                        {potentialImpact.totalImpactCount === 0
                          ? 'No other internal modules depend on this file. Modifications are isolated and safe.'
                          : `Modifying this module may affect ${potentialImpact.totalImpactCount} downstream module${
                              potentialImpact.totalImpactCount === 1 ? '' : 's'
                            } (${potentialImpact.directDependents.length} direct, ${
                              potentialImpact.totalImpactCount - potentialImpact.directDependents.length
                            } transitive).`}
                      </p>

                      {potentialImpact.transitiveImpact.length > 0 && (
                        <div className="mt-3 max-h-32 overflow-y-auto space-y-1 border-t border-white/[.06] pt-2">
                          <span className="font-mono text-[9px] uppercase text-[#77736c]">Downstream Dependents:</span>
                          {potentialImpact.transitiveImpact.map((p, idx) => (
                            <div key={idx} className="font-mono text-[10px] text-[#c8c4bc] truncate">
                              ← {p}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Outgoing Imports */}
                  <div className="mt-4">
                    <div className="font-mono text-[10px] uppercase text-[#77736c]">
                      Outgoing Imports ({selectedFileModule.out_degree || 0})
                    </div>
                    <div className="mt-1.5 max-h-28 overflow-y-auto space-y-1">
                      {(architecture?.dependency_graph?.edges || [])
                        .filter(e => e.source === selectedFileModule.path)
                        .map((e, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              const targetNode = (architecture?.dependency_graph?.nodes || []).find(
                                n => n.id === e.target
                              )
                              if (targetNode) setSelectedFileModule(targetNode)
                            }}
                            className="flex items-center justify-between rounded bg-white/[.02] p-1.5 text-xs text-[#c8c4bc] hover:bg-white/[.06] cursor-pointer"
                          >
                            <span className="truncate font-mono text-[10px]">→ {e.target}</span>
                            {e.is_external && (
                              <span className="rounded bg-indigo-500/20 px-1 font-mono text-[8px] text-indigo-300">
                                pkg
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Incoming Dependents */}
                  <div className="mt-4">
                    <div className="font-mono text-[10px] uppercase text-[#77736c]">
                      Incoming Callers ({selectedFileModule.in_degree || 0})
                    </div>
                    <div className="mt-1.5 max-h-28 overflow-y-auto space-y-1">
                      {(architecture?.dependency_graph?.edges || [])
                        .filter(e => e.target === selectedFileModule.path)
                        .map((e, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              const sourceNode = (architecture?.dependency_graph?.nodes || []).find(
                                n => n.id === e.source
                              )
                              if (sourceNode) setSelectedFileModule(sourceNode)
                            }}
                            className="flex items-center justify-between rounded bg-white/[.02] p-1.5 text-xs text-[#c8c4bc] hover:bg-white/[.06] cursor-pointer"
                          >
                            <span className="truncate font-mono text-[10px]">← {e.source}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="border-t border-white/[.08] bg-[#090b0e] p-3.5 flex items-center justify-between">
                  {makeGithubLink(selectedFileModule.path) ? (
                    <a
                      href={makeGithubLink(selectedFileModule.path)!}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/20"
                    >
                      <span>View on GitHub</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <div />
                  )}
                  <button
                    onClick={() => setFocusedModuleId(selectedFileModule.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/[.12] bg-white/[.04] px-3 py-1.5 text-xs font-medium text-[#c8c4bc] hover:text-white"
                  >
                    <Eye size={12} />
                    <span>Focus Subgraph</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// VIEW 2: COMPLETE RECURSIVE FILE EXPLORER VIEW (PRESERVED)
// -------------------------------------------------------------
interface FileExplorerProps {
  rootHierarchy?: FileHierarchyNode
  searchQuery: string
  owner?: string
  repo?: string
  defaultBranch?: string | null
  dependencyGraph?: any
}

function FileExplorerView({
  rootHierarchy,
  searchQuery,
  owner,
  repo,
  defaultBranch = 'main',
  dependencyGraph,
}: FileExplorerProps) {
  const [selectedFile, setSelectedFile] = useState<FileHierarchyNode | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    '': true,
    backend: true,
    frontend: true,
    src: true,
    app: true,
  })

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }))
  }

  const expandAll = () => {
    const allPaths: Record<string, boolean> = {}
    function collect(node: FileHierarchyNode) {
      if (node.type === 'directory') {
        allPaths[node.path] = true
        node.children?.forEach(collect)
      }
    }
    if (rootHierarchy) collect(rootHierarchy)
    setExpandedFolders(allPaths)
  }

  const collapseAll = () => {
    setExpandedFolders({ '': true })
  }

  // Incoming and outgoing dependencies for selected file
  const fileDeps = useMemo(() => {
    if (!selectedFile || !dependencyGraph) return { imports: [], importedBy: [] }
    const p = selectedFile.path
    const edges = dependencyGraph.edges || []
    const imports = edges.filter((e: any) => e.source === p).map((e: any) => e.target)
    const importedBy = edges.filter((e: any) => e.target === p).map((e: any) => e.source)
    return { imports, importedBy }
  }, [selectedFile, dependencyGraph])

  const getFileIcon = (ext?: string) => {
    const e = (ext || '').toLowerCase()
    if (['.py'].includes(e)) return <FileCode size={13} className="text-sky-400" />
    if (['.ts', '.tsx'].includes(e)) return <FileCode size={13} className="text-amber-400" />
    if (['.js', '.jsx'].includes(e)) return <FileCode size={13} className="text-yellow-400" />
    if (['.json', '.yaml', '.yml'].includes(e)) return <FileJson size={13} className="text-teal-400" />
    if (['.md', '.txt'].includes(e)) return <FileText size={13} className="text-slate-300" />
    return <FileCode size={13} className="text-[#88847d]" />
  }

  // Recursive tree node renderer
  const renderTree = (node: FileHierarchyNode, depth = 0) => {
    if (!node) return null

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchNode = (n: FileHierarchyNode): boolean => {
        if (n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q)) return true
        return (n.children || []).some(matchNode)
      }
      if (!matchNode(node)) return null
    }

    if (node.type === 'directory') {
      const isExpanded = !!expandedFolders[node.path] || !!searchQuery.trim()
      const isRoot = node.name === 'root'

      return (
        <div key={node.path || 'root'} className="select-none">
          {!isRoot && (
            <div
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${depth * 18 + 8}px` }}
              className="group flex cursor-pointer items-center justify-between gap-2 py-1.5 pr-3 text-xs text-[#c8c4bc] hover:bg-white/[.04]"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-[#77736c]">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                {isExpanded ? (
                  <FolderOpen size={14} className="text-amber-400" />
                ) : (
                  <Folder size={14} className="text-[#8e8a82]" />
                )}
                <span className="font-medium text-white">{node.name}</span>
              </div>
              <span className="font-mono text-[10px] text-[#66625b]">
                {node.file_count} files · {node.total_lines?.toLocaleString()} lines
              </span>
            </div>
          )}

          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderTree(child, isRoot ? 0 : depth + 1))}
            </div>
          )}
        </div>
      )
    }

    // File Node
    const isSelected = selectedFile?.path === node.path
    return (
      <div
        key={node.path}
        onClick={() => setSelectedFile(node)}
        style={{ paddingLeft: `${depth * 18 + 24}px` }}
        className={`group flex cursor-pointer items-center justify-between gap-2 py-1.5 pr-3 text-xs transition ${
          isSelected
            ? 'bg-amber-400/10 text-amber-300 font-medium'
            : 'text-[#aaa69e] hover:bg-white/[.03] hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {getFileIcon(node.extension)}
          <span className="truncate font-mono text-[11px]">{node.name}</span>
        </div>
        <span className="font-mono text-[10px] text-[#66625b]">
          {node.lines} lines · {Math.round((node.size || 0) / 1024)} KB
        </span>
      </div>
    )
  }

  const makeGithubLink = (path?: string) => {
    if (!path || !owner || !repo) return null
    return `https://github.com/${owner}/${repo}/blob/${defaultBranch}/${path}`
  }

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[1fr_320px]">
      {/* File Tree Left Column */}
      <div className="flex h-full flex-col border-r border-white/[.08]">
        {/* Tree Actions Toolbar */}
        <div className="flex items-center justify-between border-b border-white/[.06] bg-[#0d1014] px-4 py-2 text-xs text-[#77736c]">
          <span className="font-mono text-[10px] uppercase tracking-wider">Repository File Tree</span>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="rounded px-2 py-0.5 text-[11px] text-[#aaa69e] hover:bg-white/[.05] hover:text-white"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="rounded px-2 py-0.5 text-[11px] text-[#aaa69e] hover:bg-white/[.05] hover:text-white"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Tree Container */}
        <div className="flex-1 overflow-y-auto p-2">
          {rootHierarchy ? (
            renderTree(rootHierarchy)
          ) : (
            <div className="p-8 text-center text-xs text-[#77736c]">No file tree available for this repository.</div>
          )}
        </div>
      </div>

      {/* File Information Right Panel */}
      <div className="hidden h-full flex-col bg-[#0b0e11] p-4 md:flex">
        <div className="border-b border-white/[.08] pb-3">
          <div className="font-mono text-[9px] uppercase tracking-wider text-amber-400">File Information</div>
          <h3 className="mt-1 truncate text-sm font-semibold text-white">
            {selectedFile ? selectedFile.name : 'Select a file to inspect'}
          </h3>
        </div>

        {selectedFile ? (
          <div className="flex-1 overflow-y-auto space-y-4 pt-3 text-xs">
            <div>
              <div className="font-mono text-[10px] uppercase text-[#77736c]">Full Path</div>
              <div className="mt-1 rounded border border-white/[.08] bg-black/40 p-2 font-mono text-[11px] text-amber-300 break-all">
                {selectedFile.path}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border border-white/[.06] bg-white/[.02] p-2.5">
                <div className="font-mono text-[9px] uppercase text-[#77736c]">Lines</div>
                <div className="mt-1 font-mono text-base font-semibold text-white">{selectedFile.lines}</div>
              </div>
              <div className="rounded border border-white/[.06] bg-white/[.02] p-2.5">
                <div className="font-mono text-[9px] uppercase text-[#77736c]">Size</div>
                <div className="mt-1 font-mono text-base font-semibold text-white">
                  {Math.round((selectedFile.size || 0) / 1024)} KB
                </div>
              </div>
            </div>

            {/* Outgoing Imports */}
            <div>
              <div className="font-mono text-[10px] uppercase text-[#77736c]">
                Imports ({fileDeps.imports.length})
              </div>
              <div className="mt-1 max-h-28 overflow-y-auto rounded border border-white/[.06] bg-white/[.02] p-2 space-y-1">
                {fileDeps.imports.length > 0 ? (
                  fileDeps.imports.map((imp: string, i: number) => (
                    <div key={i} className="truncate font-mono text-[10px] text-[#c8c4bc]">
                      → {imp}
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-[#66625b]">No internal module imports detected.</div>
                )}
              </div>
            </div>

            {/* Incoming Dependents */}
            <div>
              <div className="font-mono text-[10px] uppercase text-[#77736c]">
                Imported By ({fileDeps.importedBy.length})
              </div>
              <div className="mt-1 max-h-28 overflow-y-auto rounded border border-white/[.06] bg-white/[.02] p-2 space-y-1">
                {fileDeps.importedBy.length > 0 ? (
                  fileDeps.importedBy.map((dep: string, i: number) => (
                    <div key={i} className="truncate font-mono text-[10px] text-[#c8c4bc]">
                      ← {dep}
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-[#66625b]">No internal files depend on this module.</div>
                )}
              </div>
            </div>

            {/* GitHub Link Button */}
            {makeGithubLink(selectedFile.path) && (
              <a
                href={makeGithubLink(selectedFile.path)!}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded border border-amber-400/30 bg-amber-400/10 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/20"
              >
                <span>View on GitHub</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center text-xs text-[#77736c]">
            Click any file in the tree to view its dependencies, size, and source link.
          </div>
        )}
      </div>

      {/* Mobile File Info Bottom Sheet */}
      {selectedFile && (
        <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-white/[.16] bg-[#0c0f13] p-4 shadow-2xl backdrop-blur-xl md:hidden max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-white/[.08] pb-3">
            <div className="min-w-0 flex-1 pr-2">
              <span className="font-mono text-[9px] uppercase tracking-wider text-amber-400">File Details</span>
              <h4 className="truncate text-sm font-semibold text-white">{selectedFile.name}</h4>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="rounded-lg p-1.5 text-[#8e8a82] hover:bg-white/[.06] hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3 pt-3 text-xs">
            <div className="rounded border border-white/[.08] bg-black/40 p-2 font-mono text-[10px] text-amber-300 break-all">
              {selectedFile.path}
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded border border-white/[.06] bg-white/[.02] p-2">
                <div className="font-mono text-[9px] uppercase text-[#77736c]">Lines</div>
                <div className="font-mono text-sm font-bold text-white">{selectedFile.lines}</div>
              </div>
              <div className="rounded border border-white/[.06] bg-white/[.02] p-2">
                <div className="font-mono text-[9px] uppercase text-[#77736c]">Size</div>
                <div className="font-mono text-sm font-bold text-white">{Math.round((selectedFile.size || 0) / 1024)} KB</div>
              </div>
            </div>
            {makeGithubLink(selectedFile.path) && (
              <a
                href={makeGithubLink(selectedFile.path)!}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/15 py-2.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/25"
              >
                <span>View on GitHub</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
