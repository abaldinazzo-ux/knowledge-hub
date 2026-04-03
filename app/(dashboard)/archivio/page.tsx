'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Archive } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Tipi ──────────────────────────────────────────────────────────────────────

interface Doc {
  id: string
  title: string
  file_type: string
  status: 'ready' | 'processing' | 'error' | 'draft'
  author_name: string | null
  created_at: string
  industry: string[] | null
  project_type: string[] | null
  tools: string[] | null
  file_path: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fileLabel(type: string) {
  if (type === 'pdf')  return 'PDF'
  if (type === 'docx' || type === 'doc') return 'DOC'
  if (type === 'pptx' || type === 'ppt') return 'PPT'
  if (type === 'md')   return 'MD'
  return type.toUpperCase().slice(0, 3)
}

function fileIconStyle(type: string): React.CSSProperties {
  const base: React.CSSProperties = {
    width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '11px', fontWeight: 600,
  }
  if (type === 'pdf')  return { ...base, background: 'rgba(255,69,58,0.15)',  color: '#ff453a' }
  if (type === 'md')   return { ...base, background: 'rgba(48,209,88,0.15)',  color: '#30d158' }
  if (type === 'pptx' || type === 'ppt') return { ...base, background: 'rgba(255,159,10,0.15)', color: '#ff9f0a' }
  return { ...base, background: 'rgba(10,132,255,0.15)', color: '#0a84ff' } // docx default
}

// ─── Subcomponents ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Doc['status'] }) {
  const map = {
    ready:      { label: 'Pronto',           color: '#30d158', bg: 'rgba(48,209,88,0.12)'   },
    processing: { label: 'Indicizzazione...', color: '#ffd60a', bg: 'rgba(255,214,10,0.12)' },
    error:      { label: 'Errore',            color: '#ff453a', bg: 'rgba(255,69,58,0.12)'  },
    draft:      { label: 'Bozza',             color: '#444',    bg: 'rgba(255,255,255,0.06)' },
  }
  const s = map[status] ?? map.draft
  return (
    <span style={{
      fontSize: '10px', padding: '3px 9px', borderRadius: '20px',
      fontWeight: 500, background: s.bg, color: s.color, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: '5px',
    }}>
      {status === 'processing' && (
        <span style={{
          width: '5px', height: '5px', borderRadius: '50%',
          background: '#ffd60a', display: 'inline-block',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      )}
      {s.label}
    </span>
  )
}

function TagChip({ label, type }: { label: string; type: 'industry' | 'project' | 'tool' }) {
  const styles = {
    industry: { background: 'rgba(48,209,88,0.1)',  color: '#30d158' },
    project:  { background: 'rgba(10,132,255,0.1)', color: '#0a84ff' },
    tool:     { background: 'rgba(255,159,10,0.1)', color: '#ff9f0a' },
  }
  const s = styles[type]
  return (
    <span style={{
      fontSize: '10px', padding: '2px 7px', borderRadius: '20px',
      fontWeight: 500, ...s,
    }}>
      {label}
    </span>
  )
}

function FilterPill({
  label, active, onClick,
}: {
  label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px', borderRadius: '20px', fontSize: '12px',
        border: active
          ? '0.5px solid rgba(10,132,255,0.3)'
          : '0.5px solid rgba(255,255,255,0.08)',
        background: active
          ? 'rgba(10,132,255,0.15)'
          : 'rgba(255,255,255,0.04)',
        color: active ? '#0a84ff' : '#8a8a8a',
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

// ─── Alert dialog di conferma ─────────────────────────────────────────────────

function ConfirmDialog({
  title, message, onConfirm, onCancel,
}: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: '14px', padding: '24px', maxWidth: '360px', width: '90%',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#f5f5f5', marginBottom: '8px' }}>{title}</div>
        <div style={{ fontSize: '13px', color: '#8a8a8a', marginBottom: '20px', lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '7px 16px', fontSize: '13px', color: '#8a8a8a',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: 'rgba(255,69,58,0.15)', border: '0.5px solid rgba(255,69,58,0.3)',
              borderRadius: '8px', padding: '7px 16px', fontSize: '13px', color: '#ff453a',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
            }}
          >
            Elimina
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function ArchivioPage() {
  const router = useRouter()
  const supabase = createClient()

  const [role, setRole] = useState<string>('user')
  const [userId, setUserId] = useState('')
  const [ready, setReady] = useState(false)

  const [docs, setDocs] = useState<Doc[]>([])
  const [activeFilter, setActiveFilter] = useState('Tutti')
  const [filterOptions, setFilterOptions] = useState<string[]>([])

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Doc | null>(null)

  const menuRef = useRef<HTMLDivElement>(null)

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      setRole(user.user_metadata?.role ?? 'user')
      setUserId(user.id)
      setReady(true)
    })
  }, [])

  // ── Carica documenti ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!ready) return
    loadDocs()
  }, [ready])

  async function loadDocs() {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })

    if (!data) return
    setDocs(data as Doc[])

    // Raccoglie valori distinti per i filtri
    const tags = new Set<string>()
    for (const d of data) {
      ;(d.industry ?? []).forEach((v: string) => tags.add(v))
      ;(d.project_type ?? []).forEach((v: string) => tags.add(v))
      ;(d.tools ?? []).forEach((v: string) => tags.add(v))
    }
    setFilterOptions(Array.from(tags).sort())
  }

  // ── Realtime ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!ready) return
    const channel = supabase
      .channel('documents-archive')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'documents' },
        (payload) => {
          setDocs(prev =>
            prev.map(d =>
              d.id === payload.new.id
                ? { ...d, status: payload.new.status as Doc['status'] }
                : d
            )
          )
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [ready])

  // ── Chiudi menu al click fuori ────────────────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Azioni ────────────────────────────────────────────────────────────────

  async function handleReindex(doc: Doc) {
    setMenuOpenId(null)
    await supabase.from('documents').update({ status: 'processing' }).eq('id', doc.id)
    await supabase.functions.invoke('process-document', { body: { document_id: doc.id } })
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'processing' } : d))
  }

  async function handleDelete(doc: Doc) {
    setConfirmDelete(null)
    setMenuOpenId(null)

    // 1. Elimina chunks
    await supabase.from('document_chunks').delete().eq('document_id', doc.id)

    // 2. Elimina file da Storage
    if (doc.file_path) {
      await supabase.storage.from('documents').remove([doc.file_path])
    }

    // 3. Elimina record
    await supabase.from('documents').delete().eq('id', doc.id)

    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  // ── Filtro ────────────────────────────────────────────────────────────────

  const filteredDocs = activeFilter === 'Tutti'
    ? docs
    : docs.filter(d =>
        (d.industry ?? []).includes(activeFilter) ||
        (d.project_type ?? []).includes(activeFilter) ||
        (d.tools ?? []).includes(activeFilter)
      )

  const isContributor = role === 'contributor' || role === 'admin'

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '13px' }}>
        Caricamento…
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#0a0a0a' }}>
      {confirmDelete && (
        <ConfirmDialog
          title="Elimina documento"
          message={`Vuoi eliminare "${confirmDelete.title}"? L'operazione è irreversibile e rimuoverà anche tutti i chunk indicizzati.`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#f5f5f5', margin: 0 }}>
              Archivio
            </h1>
            <p style={{ fontSize: '13px', color: '#444', margin: '2px 0 0' }}>
              {docs.filter(d => d.status === 'ready').length} documenti indicizzati
            </p>
          </div>

          {isContributor && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <GhostBtn label="↑ Carica" href="/carica" />
              <PrimaryBtn label="+ Nuovo documento" href="/editor" />
            </div>
          )}
        </div>

        {/* ── Filtri ── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <FilterPill
            label="Tutti"
            active={activeFilter === 'Tutti'}
            onClick={() => setActiveFilter('Tutti')}
          />
          {filterOptions.map(opt => (
            <FilterPill
              key={opt}
              label={opt}
              active={activeFilter === opt}
              onClick={() => setActiveFilter(opt)}
            />
          ))}
        </div>

        {/* ── Lista documenti ── */}
        {filteredDocs.length === 0 ? (
          <EmptyState isContributor={isContributor} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredDocs.map(doc => {
              const isHovered = hoveredId === doc.id
              const isMenuOpen = menuOpenId === doc.id

              return (
                <div
                  key={doc.id}
                  onMouseEnter={() => setHoveredId(doc.id)}
                  onMouseLeave={() => { setHoveredId(null) }}
                  style={{
                    background: '#111',
                    border: `0.5px solid ${isHovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: '14px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                    position: 'relative',
                  }}
                >
                  {/* Icona tipo file */}
                  <div style={fileIconStyle(doc.file_type)}>
                    {fileLabel(doc.file_type)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#f5f5f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>
                      {doc.author_name ?? '—'} · {formatDate(doc.created_at)}
                    </div>

                    {/* Tag */}
                    {((doc.industry?.length ?? 0) > 0 || (doc.project_type?.length ?? 0) > 0 || (doc.tools?.length ?? 0) > 0) && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {(doc.industry ?? []).map(v => <TagChip key={v} label={v} type="industry" />)}
                        {(doc.project_type ?? []).map(v => <TagChip key={v} label={v} type="project" />)}
                        {(doc.tools ?? []).map(v => <TagChip key={v} label={v} type="tool" />)}
                      </div>
                    )}
                  </div>

                  {/* Badge status */}
                  <StatusBadge status={doc.status} />

                  {/* Menu azioni (solo contributor+, visibile su hover) */}
                  {isContributor && (isHovered || isMenuOpen) && (
                    <div style={{ position: 'relative' }} ref={isMenuOpen ? menuRef : undefined}>
                      <button
                        onClick={e => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : doc.id) }}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '0.5px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px', width: '28px', height: '28px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: '#8a8a8a', fontSize: '16px',
                          fontFamily: 'inherit', flexShrink: 0,
                        }}
                      >
                        ⋯
                      </button>

                      {isMenuOpen && (
                        <div
                          ref={menuRef}
                          style={{
                            position: 'absolute', right: 0, top: '32px', zIndex: 100,
                            background: '#1a1a1a',
                            border: '0.5px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px', padding: '4px',
                            minWidth: '160px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                          }}
                        >
                          {doc.file_type === 'md' && (
                            <MenuAction
                              label="Modifica"
                              onClick={() => router.push(`/editor?id=${doc.id}`)}
                            />
                          )}
                          {doc.status === 'error' && (
                            <MenuAction
                              label="Reindicizza"
                              onClick={() => handleReindex(doc)}
                            />
                          )}
                          <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                          <MenuAction
                            label="Elimina"
                            danger
                            onClick={() => { setMenuOpenId(null); setConfirmDelete(doc) }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function GhostBtn({ label, href }: { label: string; href: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push(href)}
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: '8px', padding: '7px 14px',
        fontSize: '13px', color: '#8a8a8a',
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'color 0.1s',
      }}
    >
      {label}
    </button>
  )
}

function PrimaryBtn({ label, href }: { label: string; href: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push(href)}
      style={{
        background: '#0a84ff', color: 'white', border: 'none',
        borderRadius: '8px', padding: '7px 16px',
        fontSize: '13px', fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

function MenuAction({
  label, onClick, danger = false,
}: {
  label: string; onClick: () => void; danger?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: hover ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: 'none', borderRadius: '7px',
        padding: '7px 10px', fontSize: '13px',
        color: danger ? '#ff453a' : '#f5f5f5',
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'background 0.1s',
      }}
    >
      {label}
    </button>
  )
}

function EmptyState({ isContributor }: { isContributor: boolean }) {
  const router = useRouter()
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '80px 24px', gap: '12px',
    }}>
      <Archive size={32} color="#333" />
      <div style={{ fontSize: '14px', color: '#444', marginTop: '4px' }}>
        Nessun documento ancora
      </div>
      <div style={{
        fontSize: '12px', color: '#333',
        maxWidth: '280px', textAlign: 'center', lineHeight: 1.6,
      }}>
        Carica il primo documento per iniziare a costruire la knowledge base
      </div>
      {isContributor && (
        <button
          onClick={() => router.push('/carica')}
          style={{
            marginTop: '8px',
            background: '#0a84ff', color: 'white', border: 'none',
            borderRadius: '8px', padding: '8px 20px',
            fontSize: '13px', fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Carica documento
        </button>
      )}
    </div>
  )
}
