'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Tipi ──────────────────────────────────────────────────────────────────────

interface Session {
  id: string
  title: string
  project_type: string
  status: 'open' | 'completed' | 'draft'
  created_at: string
  node_count?: number
}

const PROJECT_TYPES = [
  'OEE', 'P&L Analytics', 'Supply Chain',
  'Traceability', 'Budget', 'Scheduling',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function statusBadge(status: Session['status']) {
  const map = {
    open:      { label: 'Aperta',     color: '#30d158', bg: 'rgba(48,209,88,0.12)'   },
    completed: { label: 'Completata', color: '#0a84ff', bg: 'rgba(10,132,255,0.12)'  },
    draft:     { label: 'Bozza',      color: '#555',    bg: 'rgba(255,255,255,0.06)' },
  }
  return map[status] ?? map.draft
}

// ─── Dialog nuova sessione ────────────────────────────────────────────────────

function NewSessionDialog({
  onClose, onCreate,
}: {
  onClose: () => void
  onCreate: (title: string, type: string) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState(PROJECT_TYPES[0])
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!title.trim()) return
    setLoading(true)
    await onCreate(title.trim(), custom.trim() || type)
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: '16px', padding: '24px',
        width: '420px',
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: '#f5f5f5' }}>
          Nuova sessione
        </h2>

        <label style={labelSt}>Nome cliente / progetto</label>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="es. Magazzino ABC - OEE"
          style={inputSt}
        />

        <label style={{ ...labelSt, marginTop: '14px' }}>Tipo progetto</label>
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          style={{ ...inputSt, cursor: 'pointer' }}
        >
          {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <label style={{ ...labelSt, marginTop: '14px' }}>
          Oppure tipo custom
        </label>
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          placeholder="Lascia vuoto per usare la selezione sopra"
          style={inputSt}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
          <button onClick={onClose} style={ghostBtnSt}>Annulla</button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || loading}
            style={{
              background: !title.trim() || loading ? '#1a2a3a' : '#0a84ff',
              color: !title.trim() || loading ? '#444' : 'white',
              border: 'none', borderRadius: '8px', padding: '8px 20px',
              fontSize: '13px', fontWeight: 500, cursor: !title.trim() || loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Creazione…' : 'Crea sessione'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  width: '100%', background: '#111',
  border: '0.5px solid rgba(255,255,255,0.1)',
  borderRadius: '8px', padding: '9px 12px',
  fontSize: '13px', color: '#f5f5f5',
  fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box', marginTop: '6px',
}
const labelSt: React.CSSProperties = {
  fontSize: '11px', color: '#444',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  display: 'block',
}
const ghostBtnSt: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '0.5px solid rgba(255,255,255,0.1)',
  borderRadius: '8px', padding: '8px 16px',
  fontSize: '13px', color: '#8a8a8a',
  cursor: 'pointer', fontFamily: 'inherit',
}

// ─── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({ msg, onConfirm, onCancel }: {
  msg: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '24px', maxWidth: '360px', width: '90%' }}>
        <div style={{ fontSize: '14px', color: '#f5f5f5', marginBottom: '8px', fontWeight: 500 }}>Elimina sessione</div>
        <div style={{ fontSize: '13px', color: '#8a8a8a', marginBottom: '20px', lineHeight: 1.6 }}>{msg}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onCancel} style={ghostBtnSt}>Annulla</button>
          <button onClick={onConfirm} style={{ background: 'rgba(255,69,58,0.15)', border: '0.5px solid rgba(255,69,58,0.3)', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', color: '#ff453a', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Elimina</button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function IntervistaPage() {
  const router = useRouter()
  const supabase = createClient()

  const [role, setRole] = useState('user')
  const [ready, setReady] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [nodeCounts, setNodeCounts] = useState<Record<string, number>>({})
  const [showDialog, setShowDialog] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Session | null>(null)

  const isContributor = role === 'contributor' || role === 'admin'

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      setRole(user.user_metadata?.role ?? 'user')
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    loadSessions()
  }, [ready])

  async function loadSessions() {
    const { data } = await supabase
      .from('interview_sessions')
      .select('*')
      .order('created_at', { ascending: false })
    if (!data) return
    setSessions(data as Session[])

    // Conta nodi compilati per ogni sessione
    const counts: Record<string, number> = {}
    for (const s of data) {
      const { data: nodes } = await supabase
        .from('interview_nodes')
        .select('items')
        .eq('session_id', s.id)
      counts[s.id] = (nodes ?? []).filter((n: any) => (n.items ?? []).length > 0).length
    }
    setNodeCounts(counts)
  }

  async function handleCreate(sessionTitle: string, sessionType: string) {
    const { data: user } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('interview_sessions')
      .insert({
        title: sessionTitle,
        project_type: sessionType,
        user_id: user.user?.id,
        status: 'open',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Insert error:', error)
      return
    }

    router.push(`/intervista/${data.id}/canvas`)
  }

  async function handleDelete(session: Session) {
    setConfirmDelete(null)
    await supabase.from('interview_nodes').delete().eq('session_id', session.id)
    await supabase.from('interview_sessions').delete().eq('id', session.id)
    setSessions(prev => prev.filter(s => s.id !== session.id))
  }

  if (!ready) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '13px' }}>Caricamento…</div>
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#0a0a0a' }}>
      {showDialog && (
        <NewSessionDialog onClose={() => setShowDialog(false)} onCreate={handleCreate} />
      )}
      {confirmDelete && (
        <ConfirmDialog
          msg={`Vuoi eliminare la sessione "${confirmDelete.title}"? Tutti i dati raccolti verranno persi.`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#f5f5f5' }}>
            Sessioni di intervista
          </h1>
          {isContributor && (
            <button
              onClick={() => setShowDialog(true)}
              style={{ background: '#0a84ff', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + Nuova sessione
            </button>
          )}
        </div>

        {/* Grid sessioni */}
        {sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#444' }}>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>Nessuna sessione ancora</div>
            <div style={{ fontSize: '12px', color: '#333' }}>Crea una nuova sessione per iniziare un'intervista</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {sessions.map(s => {
              const filled = nodeCounts[s.id] ?? 0
              const badge = statusBadge(s.status)
              const isHovered = hoveredId === s.id
              const menuOpen = menuOpenId === s.id

              return (
                <div
                  key={s.id}
                  onMouseEnter={() => setHoveredId(s.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => router.push(`/intervista/${s.id}/canvas`)}
                  style={{
                    background: '#111',
                    border: `0.5px solid ${isHovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: '12px', padding: '16px',
                    cursor: 'pointer', transition: 'border-color 0.15s',
                    position: 'relative',
                  }}
                >
                  {/* Titolo + badge tipo */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#f5f5f5', flex: 1, marginRight: '8px' }}>
                      {s.title}
                    </div>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(255,159,10,0.12)', color: '#ff9f0a', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {s.project_type}
                    </span>
                  </div>

                  {/* Data */}
                  <div style={{ fontSize: '12px', color: '#444', marginBottom: '12px' }}>
                    {formatDate(s.created_at)}
                  </div>

                  {/* Progress bar nodi */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#444', marginBottom: '5px' }}>
                      {filled}/8 nodi compilati
                    </div>
                    <div style={{ height: '3px', background: '#1a1a1a', borderRadius: '2px' }}>
                      <div style={{
                        height: '100%', borderRadius: '2px',
                        background: '#0a84ff',
                        width: `${(filled / 8) * 100}%`,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>

                  {/* Badge status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', padding: '3px 9px', borderRadius: '20px', fontWeight: 500, background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>

                    {/* Menu ⋯ */}
                    {isContributor && (isHovered || menuOpen) && (
                      <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setMenuOpenId(menuOpen ? null : s.id)}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '6px', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#8a8a8a', fontSize: '14px', fontFamily: 'inherit' }}
                        >
                          ⋯
                        </button>
                        {menuOpen && (
                          <div style={{ position: 'absolute', right: 0, bottom: '30px', zIndex: 100, background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '4px', minWidth: '150px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                            <MenuItem label="Apri canvas" onClick={() => router.push(`/intervista/${s.id}/canvas`)} />
                            <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                            <MenuItem label="Elimina" danger onClick={() => { setMenuOpenId(null); setConfirmDelete(s) }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function MenuItem({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'block', width: '100%', textAlign: 'left', background: hover ? 'rgba(255,255,255,0.04)' : 'transparent', border: 'none', borderRadius: '7px', padding: '7px 10px', fontSize: '13px', color: danger ? '#ff453a' : '#f5f5f5', cursor: 'pointer', fontFamily: 'inherit' }}
    >
      {label}
    </button>
  )
}
