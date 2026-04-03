'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ReactFlow as ReactFlowBase,
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, useReactFlow,
  NodeProps, Handle, Position, ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import React from 'react'

// @xyflow/react v12 exports ReactFlow as a generic — cast for TSX compatibility
const ReactFlow = ReactFlowBase as React.ComponentType<React.ComponentProps<typeof ReactFlowBase>>
import {
  Target, LayoutGrid, Users, Network,
  Database, Clock, Zap, Lock, Plus, X,
} from 'lucide-react'

// ─── Tipi ──────────────────────────────────────────────────────────────────────

interface Session {
  id: string
  title: string
  project_type: string
  status: string
  free_notes?: string
  brief_markdown?: string
}

interface NodeData {
  key: string
  label: string
  items: string[]
  notes: string
  Icon: React.ComponentType<{ size?: number; color?: string }>
  selected?: boolean
  onSelect?: (key: string) => void
  onRemove?: (key: string) => void
  [key: string]: unknown
}

// ─── Config nodi ──────────────────────────────────────────────────────────────

const NODE_CONFIG = [
  { key: 'kpi',          label: 'KPI',           Icon: Target,     x: 60,  y: 80  },
  { key: 'dim',          label: 'Dimensioni',     Icon: LayoutGrid, x: 280, y: 80  },
  { key: 'users',        label: 'Utenti',         Icon: Users,      x: 500, y: 80  },
  { key: 'stakeholders', label: 'Stakeholders',   Icon: Network,    x: 720, y: 80  },
  { key: 'data',         label: 'Sorgenti dati',  Icon: Database,   x: 60,  y: 280 },
  { key: 'period',       label: 'Periodo',        Icon: Clock,      x: 280, y: 280 },
  { key: 'pain',         label: 'Pain point',     Icon: Zap,        x: 500, y: 280 },
  { key: 'vincoli',      label: 'Vincoli',        Icon: Lock,       x: 720, y: 280 },
]

// ALL_NODES include anche la descrizione per il drawer
const ALL_NODES = [
  { key: 'kpi',          label: 'KPI & Metriche',      Icon: Target,     desc: 'Metriche da monitorare'      },
  { key: 'dim',          label: 'Dimensioni analisi',   Icon: LayoutGrid, desc: 'Come segmentare i dati'      },
  { key: 'users',        label: 'Utenti chiave',        Icon: Users,      desc: 'Chi usa il sistema'          },
  { key: 'stakeholders', label: 'Stakeholders',         Icon: Network,    desc: 'Chi decide e approva'        },
  { key: 'data',         label: 'Sorgenti dati',        Icon: Database,   desc: 'Da dove arrivano i dati'     },
  { key: 'period',       label: 'Periodo analisi',      Icon: Clock,      desc: 'Orizzonte temporale'         },
  { key: 'pain',         label: 'Pain point',           Icon: Zap,        desc: 'Problemi attuali'            },
  { key: 'vincoli',      label: 'Vincoli',              Icon: Lock,       desc: 'Limiti tecnici e di budget'  },
]

// Indice key → config (include anche custom nodes aggiunti a runtime)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeCfg = { key: string; label: string; Icon: React.ComponentType<any>; x?: number; y?: number }
const DEFAULT_NODE_MAP: Record<string, NodeCfg> = Object.fromEntries(NODE_CONFIG.map(n => [n.key, n]))

const DEFAULT_EDGES: Edge[] = [
  { id: 'e-kpi-dim',   source: 'kpi',   target: 'dim',          type: 'smoothstep', style: { stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 } },
  { id: 'e-kpi-per',   source: 'kpi',   target: 'period',       type: 'smoothstep', style: { stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 } },
  { id: 'e-usr-sta',   source: 'users', target: 'stakeholders', type: 'smoothstep', style: { stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 } },
  { id: 'e-dat-kpi',   source: 'data',  target: 'kpi',          type: 'smoothstep', style: { stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 } },
  { id: 'e-pan-kpi',   source: 'pain',  target: 'kpi',          type: 'smoothstep', style: { stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 } },
  { id: 'e-pan-vin',   source: 'pain',  target: 'vincoli',      type: 'smoothstep', style: { stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 } },
]

// ─── Suggerimenti statici ─────────────────────────────────────────────────────

const SUGGESTIONS: Record<string, { chips: string[]; question: string }> = {
  kpi:          { chips: ['COPQ', 'Tempi ciclo', 'Saturazione'],       question: 'Con quale frequenza servono i dati?' },
  dim:          { chips: ['Per impianto', 'Per prodotto', 'Per reparto'], question: 'Vogliono confronto tra periodi?' },
  users:        { chips: ['Manutentori', 'Quality manager', 'Pianificatore'], question: 'Quanti utenti contemporanei stimati?' },
  stakeholders: { chips: ['Resp. IT', 'CFO', 'Plant manager'],         question: 'Chi ha il budget decision?' },
  data:         { chips: ['SCADA', 'PLC/IoT', 'MES', 'Excel'],        question: 'I dati sono già digitalizzati?' },
  period:       { chips: ['Ultimi 12 mesi', 'Real-time', 'YoY'],      question: 'Quale granularità minima?' },
  pain:         { chips: ['Calcolo manuale', 'No alert', 'Dati tardivi'], question: 'Qual è il pain più urgente?' },
  vincoli:      { chips: ['No cloud', 'Budget limitato', '3 mesi'],   question: 'Ci sono vincoli IT?' },
}

// ─── Stato nodi ───────────────────────────────────────────────────────────────

function nodeFillState(items: string[]): 'empty' | 'partial' | 'complete' {
  if (items.length === 0) return 'empty'
  if (items.length < 3)   return 'partial'
  return 'complete'
}

function dotColor(state: ReturnType<typeof nodeFillState>) {
  if (state === 'empty')    return '#2a2a2a'
  if (state === 'partial')  return '#ffd60a'
  return '#30d158'
}

function nodeBorder(state: ReturnType<typeof nodeFillState>, selected: boolean) {
  if (selected) return { border: '1.5px solid rgba(10,132,255,0.6)', boxShadow: '0 0 24px rgba(10,132,255,0.15)' }
  if (state === 'partial')  return { border: '1px solid rgba(255,214,10,0.5)',  boxShadow: '0 0 12px rgba(255,214,10,0.08)' }
  if (state === 'complete') return { border: '1px solid rgba(48,209,88,0.5)',   boxShadow: '0 0 12px rgba(48,209,88,0.08)' }
  return { border: '0.5px solid rgba(255,255,255,0.06)', boxShadow: 'none' }
}

// ─── Nodo custom ──────────────────────────────────────────────────────────────

function MindMapNode({ data }: NodeProps) {
  const d = data as NodeData
  const state = nodeFillState(d.items ?? [])
  const selected = !!d.selected
  const borderStyle = nodeBorder(state, selected)
  const Icon = d.Icon as React.ComponentType<{ size?: number; color?: string }>
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  // Chiudi menu al click fuori
  useEffect(() => {
    if (!ctxMenu) return
    function close() { setCtxMenu(null) }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [ctxMenu])

  return (
    <>
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div
        onClick={() => d.onSelect?.(d.key)}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
        style={{
          width: '190px', background: '#1a1a1a', borderRadius: '12px',
          padding: '13px', cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
          ...borderStyle,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
          <Icon size={14} color="#444" />
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: dotColor(state), display: 'inline-block' }} />
        </div>

        {/* Titolo */}
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#f5f5f5' }}>{d.label}</div>

        {/* Preview items */}
        {(d.items ?? []).length > 0 && (
          <div style={{
            fontSize: '11px', color: '#555', marginTop: '4px', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {(d.items as string[]).join(' · ')}
          </div>
        )}

        {/* Footer */}
        <div style={{ fontSize: '10px', color: '#333', marginTop: '6px' }}>
          {(d.items ?? []).length} elementi
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999,
            background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '4px', minWidth: '140px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <button
            onClick={() => { d.onRemove?.(d.key); setCtxMenu(null) }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'transparent', border: 'none', borderRadius: '6px',
              padding: '7px 10px', fontSize: '13px', color: '#ff453a',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,69,58,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Rimuovi nodo
          </button>
        </div>
      )}
    </>
  )
}

const nodeTypes = { mindmap: MindMapNode }

// ─── Drawer node item ─────────────────────────────────────────────────────────

function DrawerNodeItem({
  label, desc, Icon, onAdd,
}: {
  label: string
  desc: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>
  onAdd: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onAdd}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `0.5px solid ${hover ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '10px', padding: '12px', marginBottom: '8px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
        transition: 'border-color 0.15s',
      }}
    >
      <Icon size={16} color="#444" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: '#f5f5f5', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>{desc}</div>
      </div>
      <span style={{ fontSize: '16px', color: '#0a84ff', lineHeight: 1, flexShrink: 0 }}>+</span>
    </div>
  )
}

// ─── Inner canvas (usa ReactFlow hooks) ───────────────────────────────────────

function CanvasInner({
  sessionId, session,
}: {
  sessionId: string
  session: Session
}) {
  const router = useRouter()
  const supabase = createClient()
  const { fitView } = useReactFlow()

  // Stato nodi (dati)
  const [nodeData, setNodeData] = useState<Record<string, { items: string[]; notes: string }>>(
    Object.fromEntries(NODE_CONFIG.map(n => [n.key, { items: [], notes: '' }]))
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, , onEdgesChange] = useEdgesState<Edge>(DEFAULT_EDGES)

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'canvas' | 'notes'>('canvas')
  const [freeNotes, setFreeNotes] = useState(session.free_notes ?? '')
  const [newItem, setNewItem] = useState('')
  const [scratchText, setScratchText] = useState('')
  const [scratchToast, setScratchToast] = useState<{ text: string; targetNode: string } | null>(null)
  const [savedIndicator, setSavedIndicator] = useState(false)

  // Analisi note libere
  const [analysisResults, setAnalysisResults] = useState<{
    suggestions: { node: string; items: string[]; confidence: number; reasoning: string }[]
    unclassified: string[]
  } | null>(null)
  const [analysisToast, setAnalysisToast] = useState(false)

  // Modalità call
  const [callMode, setCallMode] = useState(false)
  const [callView, setCallView] = useState<'split' | 'focus'>('split')
  const [callNotes, setCallNotes] = useState('')
  const [callAiSuggestions, setCallAiSuggestions] = useState<{ text: string; nodeKey: string; nodeLabel: string }[]>([])
  const [callAiLoading, setCallAiLoading] = useState(false)
  const [callEndToast, setCallEndToast] = useState(false)

  // Nodi attivi nel canvas (tutti e 8 di default)
  const [activeNodeKeys, setActiveNodeKeys] = useState<string[]>(NODE_CONFIG.map(n => n.key))
  // Config nodi custom (aggiuntivi rispetto agli 8 predefiniti)
  const [customConfigs, setCustomConfigs] = useState<Record<string, NodeCfg>>({})
  // Drawer "+ Nodo"
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [customNodeName, setCustomNodeName] = useState('')

  const dragDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const freeNotesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scratchToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callAiDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mappa completa key → config (default + custom)
  const allNodeMap: Record<string, NodeCfg> = { ...DEFAULT_NODE_MAP, ...customConfigs }

  const selectedNode = selectedKey ? allNodeMap[selectedKey] : null
  const selectedData = selectedKey ? nodeData[selectedKey] : null

  // ── Costruisce RF nodes dal nodeData ──────────────────────────────────────

  const buildNodes = useCallback((
    data: typeof nodeData,
    positions: Record<string, { x: number; y: number }>,
    selKey: string | null,
    activeKeys: string[],
    nodeMap: Record<string, NodeCfg>
  ): Node[] => {
    return activeKeys.map((key, i) => {
      const cfg = nodeMap[key]
      if (!cfg) return null
      const defaultPos = cfg.x !== undefined
        ? { x: cfg.x, y: cfg.y ?? 80 }
        : { x: 60 + (i % 4) * 230, y: 80 + Math.floor(i / 4) * 180 }
      return {
        id: key,
        type: 'mindmap',
        position: positions[key] ?? defaultPos,
        data: {
          key,
          label: cfg.label,
          Icon: cfg.Icon,
          items: data[key]?.items ?? [],
          notes: data[key]?.notes ?? '',
          selected: key === selKey,
          onSelect: (k: string) => handleSelectNode(k),
          onRemove: (k: string) => handleRemoveNode(k),
        },
        draggable: true,
      }
    }).filter(Boolean) as Node[]
  }, [])

  // ── Carica dati da Supabase ────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: savedNodes } = await supabase
        .from('interview_nodes')
        .select('*')
        .eq('session_id', sessionId)

      const positions: Record<string, { x: number; y: number }> = {}
      const newData: typeof nodeData = Object.fromEntries(
        NODE_CONFIG.map(n => [n.key, { items: [], notes: '' }])
      )

      if (savedNodes) {
        for (const sn of savedNodes) {
          positions[sn.node_key] = { x: sn.position_x, y: sn.position_y }
          newData[sn.node_key] = { items: sn.items ?? [], notes: sn.notes ?? '' }
        }
      }

      setNodeData(newData)
      setNodes(buildNodes(newData, positions, null, NODE_CONFIG.map(n => n.key), DEFAULT_NODE_MAP))
      setTimeout(() => fitView({ duration: 400, padding: 0.15 }), 100)
    }
    load()
  }, [sessionId])

  // ── Aggiorna nodi RF quando cambia selezione o dati ───────────────────────

  useEffect(() => {
    setNodes(prev => {
      const positions = Object.fromEntries(prev.map(n => [n.id, n.position]))
      return buildNodes(nodeData, positions, selectedKey, activeNodeKeys, allNodeMap)
    })
  }, [selectedKey, nodeData, activeNodeKeys, customConfigs])

  // ── Seleziona nodo ────────────────────────────────────────────────────────

  function handleSelectNode(key: string) {
    if (callMode) return
    if (selectedKey === key && panelOpen) {
      setPanelOpen(false)
      setSelectedKey(null)
    } else {
      setSelectedKey(key)
      setPanelOpen(true)
      setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 50)
    }
  }

  // ── Aggiungi / rimuovi nodi dal canvas ───────────────────────────────────

  function handleAddNode(key: string, cfg?: NodeCfg) {
    if (activeNodeKeys.includes(key)) return
    if (cfg) setCustomConfigs(prev => ({ ...prev, [key]: cfg }))
    if (!nodeData[key]) {
      setNodeData(prev => ({ ...prev, [key]: { items: [], notes: '' } }))
    }
    setActiveNodeKeys(prev => [...prev, key])
    setDrawerOpen(false)
  }

  function handleRemoveNode(key: string) {
    if (selectedKey === key) { setPanelOpen(false); setSelectedKey(null) }
    setActiveNodeKeys(prev => prev.filter(k => k !== key))
  }

  function handleAddCustomNode() {
    const name = customNodeName.trim()
    if (!name) return
    const key = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const cfg: NodeCfg = { key, label: name, Icon: Plus }
    handleAddNode(key, cfg)
    setCustomNodeName('')
  }

  // ── Salva posizioni al drag ────────────────────────────────────────────────

  function onNodeDragStop(_: any, node: Node) {
    if (dragDebounce.current) clearTimeout(dragDebounce.current)
    dragDebounce.current = setTimeout(async () => {
      const data = nodeData[node.id]
      await supabase.from('interview_nodes').upsert(
        {
          session_id: sessionId,
          node_key: node.id,
          position_x: node.position.x,
          position_y: node.position.y,
          items: data?.items ?? [],
          notes: data?.notes ?? '',
        },
        { onConflict: 'session_id,node_key' }
      )
    }, 500)
  }

  // ── Salva dati nodo ────────────────────────────────────────────────────────

  async function saveNodeData(key: string, items: string[], notes: string) {
    const node = nodes.find(n => n.id === key)
    const pos = node?.position ?? NODE_CONFIG.find(c => c.key === key) ?? { x: 0, y: 0 }
    await supabase.from('interview_nodes').upsert(
      {
        session_id: sessionId,
        node_key: key,
        position_x: (pos as any).x,
        position_y: (pos as any).y,
        items,
        notes,
      },
      { onConflict: 'session_id,node_key' }
    )
  }

  // ── Aggiunge elemento al nodo aperto ──────────────────────────────────────

  function addItem(text: string) {
    if (!selectedKey || !text.trim()) return
    const updated = { ...nodeData[selectedKey], items: [...nodeData[selectedKey].items, text.trim()] }
    setNodeData(prev => ({ ...prev, [selectedKey]: updated }))
    saveNodeData(selectedKey, updated.items, updated.notes)
    setNewItem('')
  }

  function removeItem(idx: number) {
    if (!selectedKey) return
    const updated = { ...nodeData[selectedKey], items: nodeData[selectedKey].items.filter((_, i) => i !== idx) }
    setNodeData(prev => ({ ...prev, [selectedKey]: updated }))
    saveNodeData(selectedKey, updated.items, updated.notes)
  }

  function updateNotes(text: string) {
    if (!selectedKey) return
    const updated = { ...nodeData[selectedKey], notes: text }
    setNodeData(prev => ({ ...prev, [selectedKey]: updated }))
    saveNodeData(selectedKey, updated.items, text)
  }

  // ── Riallinea ─────────────────────────────────────────────────────────────

  function realign() {
    const cols = 4, gapX = 230, gapY = 180, startX = 60, startY = 80
    setNodes(prev =>
      prev.map((n, i) => ({
        ...n,
        position: {
          x: startX + (i % cols) * gapX,
          y: startY + Math.floor(i / cols) * gapY,
        },
      }))
    )
    setTimeout(() => fitView({ duration: 500, padding: 0.15 }), 50)
  }

  // ── Free notes debounce save ───────────────────────────────────────────────

  function handleFreeNotesChange(text: string) {
    setFreeNotes(text)
    if (freeNotesDebounce.current) clearTimeout(freeNotesDebounce.current)
    freeNotesDebounce.current = setTimeout(async () => {
      await supabase.from('interview_sessions').update({ free_notes: text }).eq('id', sessionId)
    }, 5000)
  }

  // ── Scratchpad invio ──────────────────────────────────────────────────────

  function handleScratchEnter() {
    if (!scratchText.trim()) return
    const text = scratchText.trim()
    setScratchText('')
    // Simulazione AI: suggerisci Pain point (logica semplificata)
    const targetNode = 'Pain point'
    setScratchToast({ text, targetNode })
    if (scratchToastTimer.current) clearTimeout(scratchToastTimer.current)
    scratchToastTimer.current = setTimeout(() => setScratchToast(null), 8000)
  }

  // ── Modalità call ─────────────────────────────────────────────────────────

  function handleStartCall() {
    setCallMode(true)
    setCallView('split')
    setCallNotes('')
    setCallAiSuggestions([])
    setPanelOpen(false)
    setSelectedKey(null)
  }

  async function handleEndCall() {
    if (callNotes.trim()) {
      const ts = new Date().toLocaleString('it-IT')
      const separator = `\n\n---\n**Note call — ${ts}**\n\n${callNotes.trim()}`
      const updated = freeNotes + separator
      setFreeNotes(updated)
      await supabase.from('interview_sessions').update({ free_notes: updated }).eq('id', sessionId)
    }
    setCallMode(false)
    setCallNotes('')
    setCallAiSuggestions([])
    if (callAiDebounce.current) clearTimeout(callAiDebounce.current)
    setCallEndToast(true)
    setTimeout(() => setCallEndToast(false), 3000)
  }

  function handleCallNotesChange(text: string) {
    setCallNotes(text)
    if (callAiDebounce.current) clearTimeout(callAiDebounce.current)
    if (text.trim().length < 20) return
    callAiDebounce.current = setTimeout(async () => {
      setCallAiLoading(true)
      try {
        const { data } = await supabase.functions.invoke('analyze-quick', {
          body: { session_id: sessionId, text, node_keys: activeNodeKeys },
        })
        if (data?.suggestions) setCallAiSuggestions(data.suggestions)
      } catch {}
      setCallAiLoading(false)
    }, 4000)
  }

  function handleAddAllSuggestions() {
    const newData = { ...nodeData }
    for (const s of callAiSuggestions) {
      if (!s.nodeKey || !s.text) continue
      const existing = newData[s.nodeKey] ?? { items: [], notes: '' }
      newData[s.nodeKey] = { ...existing, items: [...existing.items, s.text] }
      saveNodeData(s.nodeKey, newData[s.nodeKey].items, newData[s.nodeKey].notes)
    }
    setNodeData(newData)
    setCallAiSuggestions([])
  }

  // ── Genera brief ──────────────────────────────────────────────────────────

  async function handleGenerateBrief() {
    const d = nodeData
    const today = new Date().toLocaleDateString('it-IT')
    const lines: string[] = [
      `# Brief — ${session.title}`,
      `Data: ${today}`,
      `Consulente: —`,
      '',
      `## Contesto`,
      ...(d.stakeholders.notes ? [d.stakeholders.notes, ''] : []),
      `## KPI prioritari`,
      ...d.kpi.items.map(i => `- ${i}`), '',
      `## Dimensioni di analisi`,
      ...d.dim.items.map(i => `- ${i}`), '',
      `## Utenti e profili`,
      ...d.users.items.map(i => `- ${i}`), '',
      `## Sorgenti dati`,
      ...d.data.items.map(i => `- ${i}`), '',
      `## Pain point rilevati`,
      ...d.pain.items.map(i => `- ${i}`), '',
      `## Vincoli`,
      ...d.vincoli.items.map(i => `- ${i}`), '',
      `## Periodo di analisi`,
      ...d.period.items.map(i => `- ${i}`), '',
      `## Note del consulente`,
      ...NODE_CONFIG.map(n => d[n.key].notes).filter(Boolean), '',
      `## Domande ancora aperte`,
      ...NODE_CONFIG
        .filter(n => d[n.key].items.length < 3)
        .map(n => `- ${n.label}: ${SUGGESTIONS[n.key]?.question ?? ''}`),
    ]

    const brief = lines.join('\n')
    await supabase.from('interview_sessions').update({
      brief_markdown: brief,
      status: 'completed',
    }).eq('id', sessionId)

    router.push(`/intervista/${sessionId}/brief`)
  }

  // ── Conteggi ──────────────────────────────────────────────────────────────

  const filledCount = Object.values(nodeData).filter(n => n.items.length > 0).length

  return (
    <div style={{ display: 'flex', height: '100%' }}>

      {/* ── Sidebar sinistra ── */}
      <div style={{ width: '200px', flexShrink: 0, background: '#111', borderRight: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '14px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#f5f5f5', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.title}
          </div>
          <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '20px', background: 'rgba(255,159,10,0.12)', color: '#ff9f0a', fontWeight: 500 }}>
            {session.project_type}
          </span>
        </div>

        {/* Lista nodi */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          <div style={{ fontSize: '10px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 8px 4px' }}>
            NODI
          </div>
          {activeNodeKeys.map(key => {
            const cfg = allNodeMap[key]
            if (!cfg) return null
            const data = nodeData[key] ?? { items: [], notes: '' }
            const state = nodeFillState(data.items)
            const isSelected = selectedKey === key
            return (
              <div
                key={key}
                onClick={() => handleSelectNode(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 8px', borderRadius: '6px', cursor: 'pointer',
                  background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: dotColor(state), flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: '#8a8a8a', flex: 1 }}>{cfg.label}</span>
                <span style={{ fontSize: '10px', color: '#444' }}>{data.items.length}</span>
              </div>
            )
          })}
        </div>

        {/* Footer sidebar */}
        <div style={{ padding: '12px', borderTop: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={handleGenerateBrief}
            disabled={filledCount < 4}
            style={{
              width: '100%', background: filledCount >= 4 ? '#30d158' : '#1a2a1a',
              color: filledCount >= 4 ? 'white' : '#333',
              border: 'none', borderRadius: '8px', padding: '8px',
              fontSize: '12px', fontWeight: 500, cursor: filledCount >= 4 ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            Genera brief →
          </button>
          <button
            onClick={async () => {
              await supabase.from('interview_sessions').update({ status: 'draft' }).eq('id', sessionId)
              setSavedIndicator(true)
              setTimeout(() => setSavedIndicator(false), 2000)
            }}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '7px', fontSize: '12px', color: savedIndicator ? '#30d158' : '#8a8a8a', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {savedIndicator ? 'Salvato ✓' : 'Salva bozza'}
          </button>
        </div>
      </div>

      {/* ── Area principale ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {/* Topbar canvas */}
        <div style={{ height: '44px', flexShrink: 0, background: '#111', borderBottom: '0.5px solid rgba(255,255,255,0.06)', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {callMode ? (
            <>
              {/* Badge call in corso */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ff453a', animation: 'callpulse 1.5s infinite' }} />
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#ff453a' }}>Call in corso</span>
              </div>

              {/* Segmented Split | Focus */}
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '3px', display: 'flex' }}>
                {(['split', 'focus'] as const).map(mode => {
                  const labels = { split: 'Split', focus: 'Focus' }
                  const active = callView === mode
                  return (
                    <button
                      key={mode}
                      onClick={() => setCallView(mode)}
                      style={{
                        padding: '5px 16px', borderRadius: '7px', fontSize: '12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                        color: active ? 'white' : 'rgba(255,255,255,0.4)',
                        fontWeight: active ? 500 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {labels[mode]}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={handleEndCall}
                style={{ background: 'rgba(255,69,58,0.15)', border: '0.5px solid rgba(255,69,58,0.3)', borderRadius: '7px', padding: '5px 16px', fontSize: '12px', color: '#ff453a', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
              >
                Termina call
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: '13px', color: '#f5f5f5', fontWeight: 500 }}>{session.title}</span>

              {/* Segmented control */}
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '3px', display: 'flex' }}>
                {(['canvas', 'notes'] as const).map(mode => {
                  const labels = { canvas: 'Canvas', notes: 'Note libere' }
                  const active = viewMode === mode
                  return (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      style={{
                        padding: '5px 16px', borderRadius: '7px', fontSize: '12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                        color: active ? 'white' : 'rgba(255,255,255,0.4)',
                        fontWeight: active ? 500 : 400,
                        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.5)' : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      {labels[mode]}
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={realign}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '7px', padding: '5px 12px', fontSize: '12px', color: '#8a8a8a', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ⊞ Riallinea
                </button>
                <button
                  onClick={handleStartCall}
                  style={{ background: 'rgba(255,69,58,0.12)', border: '0.5px solid rgba(255,69,58,0.2)', borderRadius: '7px', padding: '5px 12px', fontSize: '12px', color: '#ff453a', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ● Modalità call
                </button>
              </div>
            </>
          )}
        </div>

        {/* Canvas + colonna call + pannello + scratchpad */}
        <div style={{ flex: 1, display: 'flex', flexDirection: callMode && callView === 'split' ? 'row' : 'column', overflow: 'hidden' }}>

          {/* Lato sinistro: canvas + note + pannello + scratchpad */}
          <div style={{
            flex: 1, minWidth: 0,
            display: callMode && callView === 'focus' ? 'none' : 'flex',
            flexDirection: 'column', overflow: 'hidden',
          }}>

          {/* Canvas React Flow */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', display: (viewMode === 'canvas' || callMode) ? 'block' : 'none' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={onNodeDragStop}
              nodeTypes={nodeTypes}
              nodesDraggable
              nodesConnectable={false}
              fitView
              style={{ background: '#0a0a0a', width: '100%', height: '100%' }}
            >
              <Background color="rgba(255,255,255,0.03)" gap={24} size={1} />
              <Controls style={{ background: '#111', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} />
              <MiniMap
                style={{ background: '#111', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}
                nodeColor="#2a2a2a"
                maskColor="rgba(0,0,0,0.6)"
              />

              {/* Pulsante + aggiungi nodo */}
              {!callMode && (
                <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                  <button
                    onClick={() => setDrawerOpen(true)}
                    style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '7px', fontSize: '12px', color: '#8a8a8a', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    + Nodo
                  </button>
                </div>
              )}
            </ReactFlow>
          </div>

          {/* Note libere */}
          {viewMode === 'notes' && !callMode && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <textarea
                value={freeNotes}
                onChange={e => handleFreeNotesChange(e.target.value)}
                placeholder="Scrivi liberamente..."
                style={{
                  flex: 1, width: '100%', background: '#0d0d0d', border: 'none', outline: 'none', resize: 'none',
                  padding: '24px 48px', fontSize: '14px', color: '#e5e5e5', lineHeight: 2.0,
                  fontFamily: "'SF Mono', 'Monaco', monospace", boxSizing: 'border-box',
                }}
              />
              <div style={{ height: '40px', background: '#111', borderTop: '0.5px solid rgba(255,255,255,0.06)', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: '11px', color: '#333' }}>Salvataggio automatico ogni 5s</span>
                <button
                  disabled={freeNotes.length < 50}
                  onClick={async () => {
                    console.log('Analizza clicked')
                    console.log('Text length:', freeNotes.length)
                    console.log('Is disabled:', freeNotes.length < 50)
                    console.log('handleAnalyze called')
                    console.log('Calling analyze-interview-notes...')
                    const response = await supabase.functions.invoke('analyze-interview-notes', {
                      body: { session_id: sessionId, notes: freeNotes },
                    })
                    console.log('Response:', response)
                    console.log('Data:', JSON.stringify(response.data))
                    console.log('Error:', response.error)
                    if (response.data?.suggestions) {
                      setAnalysisResults(response.data)
                    }
                  }}
                  style={{
                    background: freeNotes.length >= 50 ? '#0a84ff' : '#1a1a1a',
                    color: freeNotes.length >= 50 ? 'white' : '#333',
                    border: 'none', borderRadius: '7px', padding: '5px 14px',
                    fontSize: '12px', cursor: freeNotes.length >= 50 ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                    pointerEvents: 'all', zIndex: 9999,
                  }}
                >
                  Analizza con AI →
                </button>
              </div>
            </div>
          )}

          {/* Pannello inferiore nodo */}
          {!callMode && <div style={{
            height: panelOpen ? '50vh' : 0,
            overflow: 'hidden',
            transition: 'height 0.35s cubic-bezier(0.4,0,0.2,1)',
            flexShrink: 0,
            borderTop: panelOpen ? '0.5px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            {selectedNode && selectedData && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0d0d0d' }}>
                {/* Header pannello */}
                <div style={{ height: '41px', padding: '0 16px', background: '#111', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: dotColor(nodeFillState(selectedData.items)) }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f5f5f5' }}>{selectedNode.label}</span>
                  </div>
                  <button
                    onClick={() => { setPanelOpen(false); setSelectedKey(null) }}
                    style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>

                {/* Tre colonne */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                  {/* Col 1: Elementi */}
                  <div style={{ flex: 1, padding: '14px 16px', borderRight: '0.5px solid rgba(255,255,255,0.06)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Elementi raccolti</div>

                    {selectedData.items.map((item, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '7px', padding: '5px 9px', fontSize: '12px', color: '#f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{item}</span>
                        <button
                          onClick={() => removeItem(i)}
                          style={{ background: 'transparent', border: 'none', color: '#333', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#ff453a')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#333')}
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <input
                        value={newItem}
                        onChange={e => setNewItem(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addItem(newItem)}
                        placeholder="Aggiungi elemento…"
                        style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '7px', padding: '6px 9px', fontSize: '12px', color: '#f5f5f5', fontFamily: 'inherit', outline: 'none' }}
                      />
                      <button
                        onClick={() => addItem(newItem)}
                        style={{ background: '#0a84ff', border: 'none', borderRadius: '7px', padding: '6px 12px', fontSize: '12px', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Col 2: Note */}
                  <div style={{ flex: 1, padding: '14px 16px', borderRight: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '11px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Note</div>
                    <textarea
                      value={selectedData.notes}
                      onChange={e => updateNotes(e.target.value)}
                      placeholder="Note libere sul nodo…"
                      style={{
                        flex: 1, background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)',
                        borderRadius: '8px', padding: '9px', fontSize: '12px', color: '#f5f5f5',
                        resize: 'none', lineHeight: 1.6, fontFamily: 'inherit', outline: 'none', minHeight: '120px',
                      }}
                    />
                  </div>

                  {/* Col 3: AI + domanda */}
                  <div style={{ flex: 1, padding: '14px 16px', overflowY: 'auto' }}>
                    <div style={{ fontSize: '11px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>AI</div>

                    {selectedKey && SUGGESTIONS[selectedKey] && (
                      <>
                        <div style={{ background: 'rgba(10,132,255,0.06)', border: '0.5px solid rgba(10,132,255,0.15)', borderRadius: '10px', padding: '11px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#30d158', animation: 'pulse 2s infinite' }} />
                            <span style={{ fontSize: '11px', color: '#0a84ff', fontWeight: 500 }}>Suggerimenti</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {SUGGESTIONS[selectedKey].chips.map(chip => (
                              <button
                                key={chip}
                                onClick={() => addItem(chip)}
                                style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '20px', background: 'rgba(10,132,255,0.1)', border: '0.5px solid rgba(10,132,255,0.2)', color: '#0a84ff', cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                + {chip}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ background: 'rgba(255,214,10,0.06)', border: '0.5px solid rgba(255,214,10,0.15)', borderRadius: '8px', padding: '9px', fontSize: '12px', color: 'rgba(255,214,10,0.75)' }}>
                          {SUGGESTIONS[selectedKey].question}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>}

          {/* Scratchpad */}
          {!callMode && (
            <div style={{ height: '40px', flexShrink: 0, background: '#111', borderTop: '0.5px solid rgba(255,255,255,0.06)', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: '#333', whiteSpace: 'nowrap' }}>Note rapide →</span>
              <input
                value={scratchText}
                onChange={e => setScratchText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleScratchEnter()}
                placeholder="Scrivi durante la call..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', color: '#e5e5e5', fontFamily: 'inherit' }}
              />
              <span style={{ fontSize: '10px', color: '#2a2a2a', whiteSpace: 'nowrap' }}>↵ classifica</span>
            </div>
          )}
          </div>{/* end lato sinistro */}

          {/* Colonna destra: note call + AI (solo in call mode) */}
          {callMode && (
            <div style={{
              width: callView === 'split' ? '320px' : '100%',
              flexShrink: 0,
              background: '#0d0d0d',
              borderLeft: callView === 'split' ? '0.5px solid rgba(255,255,255,0.06)' : 'none',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Textarea note call */}
              <textarea
                value={callNotes}
                onChange={e => handleCallNotesChange(e.target.value)}
                placeholder="Scrivi le note della call in tempo reale…"
                autoFocus
                style={{
                  flex: 1, width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none',
                  padding: '20px', fontSize: '13px', color: '#e5e5e5', lineHeight: 1.9,
                  fontFamily: "'SF Mono', 'Monaco', monospace", boxSizing: 'border-box',
                }}
              />

              {/* AI suggestions */}
              <div style={{ flexShrink: 0, borderTop: '0.5px solid rgba(255,255,255,0.06)', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  {callAiLoading
                    ? <span style={{ fontSize: '11px', color: '#555', fontStyle: 'italic' }}>Analisi in corso…</span>
                    : <span style={{ fontSize: '11px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI — suggerisce</span>
                  }
                </div>

                {callAiSuggestions.length > 0 ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '160px', overflowY: 'auto', marginBottom: '8px' }}>
                      {callAiSuggestions.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '7px', padding: '6px 10px' }}>
                          <span style={{ flex: 1, fontSize: '12px', color: '#e5e5e5' }}>{s.text}</span>
                          <span style={{ fontSize: '10px', color: '#444', flexShrink: 0, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>{s.nodeLabel}</span>
                          <button
                            onClick={() => {
                              const existing = nodeData[s.nodeKey] ?? { items: [], notes: '' }
                              const updated = { ...existing, items: [...existing.items, s.text] }
                              setNodeData(prev => ({ ...prev, [s.nodeKey]: updated }))
                              saveNodeData(s.nodeKey, updated.items, updated.notes)
                              setCallAiSuggestions(prev => prev.filter((_, j) => j !== i))
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#0a84ff', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', flexShrink: 0, lineHeight: 1 }}
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleAddAllSuggestions}
                      style={{ width: '100%', background: 'rgba(10,132,255,0.1)', border: '0.5px solid rgba(10,132,255,0.2)', borderRadius: '7px', padding: '6px', fontSize: '12px', color: '#0a84ff', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Aggiungi tutti →
                    </button>
                  </>
                ) : (
                  <div style={{ fontSize: '12px', color: '#2a2a2a', textAlign: 'center', padding: '12px 0' }}>
                    {callNotes.length < 20 ? 'Inizia a scrivere…' : 'Analisi ogni 4s'}
                  </div>
                )}
              </div>

              {/* Footer colonna */}
              <div style={{ flexShrink: 0, height: '36px', background: '#111', borderTop: '0.5px solid rgba(255,255,255,0.06)', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: '#333' }}>{callNotes.length} car</span>
                <span style={{ fontSize: '11px', color: '#333' }}>Salvate al termine</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Drawer "+ Nodo" ── */}
      {drawerOpen && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: '260px', zIndex: 200,
          background: '#111', borderLeft: '0.5px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}>
          {/* Header drawer */}
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <span style={{ fontSize: '13px', color: '#f5f5f5', fontWeight: 500 }}>Aggiungi nodo</span>
            <button
              onClick={() => setDrawerOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Nodi disponibili (non ancora nel canvas) */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
            {(() => {
              const available = ALL_NODES.filter(n => !activeNodeKeys.includes(n.key))
              if (available.length === 0) {
                return <div style={{ fontSize: '12px', color: '#444', textAlign: 'center', padding: '20px 0' }}>Tutti i nodi sono già nel canvas</div>
              }
              return available.map(n => {
                const Icon = n.Icon
                return (
                  <DrawerNodeItem
                    key={n.key}
                    label={n.label}
                    desc={n.desc}
                    Icon={Icon}
                    onAdd={() => handleAddNode(n.key)}
                  />
                )
              })
            })()}

            {/* Separatore + nodo custom */}
            <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />
            <div style={{ fontSize: '11px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              Crea nodo custom
            </div>
            <input
              value={customNodeName}
              onChange={e => setCustomNodeName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCustomNode()}
              placeholder="Nome del nodo..."
              style={{
                width: '100%', background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '8px 10px',
                fontSize: '12px', color: '#f5f5f5', fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box', marginBottom: '8px',
              }}
            />
            <button
              onClick={handleAddCustomNode}
              disabled={!customNodeName.trim()}
              style={{
                width: '100%', background: customNodeName.trim() ? '#0a84ff' : '#1a1a1a',
                color: customNodeName.trim() ? 'white' : '#333',
                border: 'none', borderRadius: '8px', padding: '8px',
                fontSize: '12px', fontWeight: 500, cursor: customNodeName.trim() ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              Aggiungi
            </button>
          </div>
        </div>
      )}

      {/* Toast scratchpad */}
      {scratchToast && (
        <div style={{
          position: 'fixed', bottom: '56px', left: '220px', zIndex: 1000,
          background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: '12px', padding: '12px 16px', maxWidth: '360px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: '12px', color: '#f5f5f5', marginBottom: '10px', lineHeight: 1.5 }}>
            AI suggerisce: aggiungere <strong>"{scratchToast.text}"</strong> al nodo {scratchToast.targetNode}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                addItem(scratchToast.text)
                setScratchToast(null)
              }}
              style={{ background: '#0a84ff', border: 'none', borderRadius: '7px', padding: '5px 14px', fontSize: '12px', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Conferma
            </button>
            <button
              onClick={() => setScratchToast(null)}
              style={{ background: 'transparent', border: 'none', fontSize: '12px', color: '#444', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Ignora
            </button>
          </div>
        </div>
      )}

      {/* Overlay risultati analisi note libere */}
      {analysisResults && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: '300px', zIndex: 300,
          background: '#111', borderLeft: '0.5px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#f5f5f5' }}>Suggerimenti AI</span>
            <button
              onClick={() => setAnalysisResults(null)}
              style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* Suggestions */}
          <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto' }}>
            {analysisResults.suggestions.map((s, si) => {
              const cfg = allNodeMap[s.node]
              const Icon = cfg?.Icon
              return (
                <div key={si} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                  {/* Header card nodo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    {Icon && <Icon size={12} color="#555" />}
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#f5f5f5' }}>
                      {cfg?.label ?? s.node}
                    </span>
                  </div>

                  {/* Chips items */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {s.items.map((item, ii) => (
                      <button
                        key={ii}
                        onClick={() => {
                          setAnalysisResults(prev => {
                            if (!prev) return prev
                            const newSuggestions = prev.suggestions.map((sg, sgi) =>
                              sgi === si
                                ? { ...sg, items: sg.items.filter((_, i) => i !== ii) }
                                : sg
                            ).filter(sg => sg.items.length > 0)
                            return { ...prev, suggestions: newSuggestions }
                          })
                        }}
                        style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(10,132,255,0.1)', color: '#0a84ff', border: '0.5px solid rgba(10,132,255,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {item} ×
                      </button>
                    ))}
                  </div>

                  {/* Aggiungi tutti al nodo */}
                  <button
                    onClick={() => {
                      const existing = nodeData[s.node] ?? { items: [], notes: '' }
                      const updated = { ...existing, items: [...existing.items, ...s.items] }
                      setNodeData(prev => ({ ...prev, [s.node]: updated }))
                      saveNodeData(s.node, updated.items, updated.notes)
                      setAnalysisResults(prev => {
                        if (!prev) return prev
                        const newSuggestions = prev.suggestions.filter((_, sgi) => sgi !== si)
                        return { ...prev, suggestions: newSuggestions }
                      })
                    }}
                    style={{ background: 'none', border: 'none', color: '#0a84ff', cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit', marginTop: '6px', padding: 0 }}
                  >
                    Aggiungi tutti al nodo →
                  </button>
                </div>
              )
            })}

            {/* Non classificato */}
            {analysisResults.unclassified.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '11px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Non classificato</div>
                {analysisResults.unclassified.map((t, i) => (
                  <div key={i} style={{ fontSize: '11px', color: '#555', marginBottom: '3px' }}>{t}</div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 16px', borderTop: '0.5px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <button
              onClick={() => {
                const newData = { ...nodeData }
                for (const s of analysisResults.suggestions) {
                  const existing = newData[s.node] ?? { items: [], notes: '' }
                  newData[s.node] = { ...existing, items: [...existing.items, ...s.items] }
                  saveNodeData(s.node, newData[s.node].items, newData[s.node].notes)
                }
                setNodeData(newData)
                setAnalysisResults(null)
                setAnalysisToast(true)
                setTimeout(() => setAnalysisToast(false), 3000)
              }}
              style={{ width: '100%', background: '#0a84ff', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '12px', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
            >
              Applica tutti i suggerimenti
            </button>
            <button
              onClick={() => setAnalysisResults(null)}
              style={{ width: '100%', background: 'transparent', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '12px', color: '#555', cursor: 'pointer', fontFamily: 'inherit', marginTop: '6px' }}
            >
              Chiudi
            </button>
          </div>
        </div>
      )}

      {/* Toast canvas aggiornato */}
      {analysisToast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: '#1a1a1a', border: '0.5px solid rgba(48,209,88,0.3)',
          borderRadius: '10px', padding: '10px 20px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          fontSize: '13px', color: '#30d158', fontWeight: 500,
        }}>
          ✓ Canvas aggiornato
        </div>
      )}

      {/* Toast fine call */}
      {callEndToast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: '#1a1a1a', border: '0.5px solid rgba(48,209,88,0.3)',
          borderRadius: '10px', padding: '10px 20px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          fontSize: '13px', color: '#30d158', fontWeight: 500,
        }}>
          ✓ Note call salvate nelle note libere
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes callpulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .react-flow__attribution { display: none !important; }
        .react-flow__controls button {
          background: #1a1a1a !important;
          border-color: rgba(255,255,255,0.08) !important;
          color: #8a8a8a !important;
        }
      `}</style>
    </div>
  )
}

// ─── Page wrapper con ReactFlowProvider ───────────────────────────────────────

export default function CanvasPage() {
  const params = useParams()
  const sessionId = params.id as string
  const supabase = createClient()
  const router = useRouter()

  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
    })
    supabase.from('interview_sessions').select('*').eq('id', sessionId).single().then(({ data }) => {
      if (data) setSession(data as Session)
      setReady(true)
    })
  }, [sessionId])

  if (!ready || !session) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '13px' }}>Caricamento canvas…</div>
  }

  return (
    <ReactFlowProvider>
      <CanvasInner sessionId={sessionId} session={session} />
    </ReactFlowProvider>
  )
}
