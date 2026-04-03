'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, FileText, File } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Metadati ─────────────────────────────────────────────────────────────────

const INDUSTRIES = ['Tutte', 'Manufacturing', 'Food & Bev.', 'Pharma', 'Retail', 'Finance', 'Energy']
const PROJECT_TYPES = ['Analytics', 'OEE', 'P&L', 'Traceability', 'Budget', 'Scheduling', 'Supply Chain']
const TOOLS = ['QuickSight', 'PowerBI', 'Qlik', 'Excel', 'Tableau', 'Looker']

// ─── Tipi ──────────────────────────────────────────────────────────────────────

type UploadStep = 'idle' | 'uploading' | 'indexing' | 'done' | 'error'

interface RecentDoc {
  id: string
  title: string
  file_type: string
  status: 'processing' | 'ready' | 'error'
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileColor(ext: string) {
  if (ext === 'pdf') return '#ff453a'
  if (ext === 'docx' || ext === 'doc') return '#0a84ff'
  if (ext === 'pptx' || ext === 'ppt') return '#ff9f0a'
  return '#8a8a8a'
}

function fileExt(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ─── Pill multi-select ────────────────────────────────────────────────────────

function PillGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (val: string[]) => void
}) {
  function toggle(opt: string) {
    onChange(
      selected.includes(opt)
        ? selected.filter(s => s !== opt)
        : [...selected, opt]
    )
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '10px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {options.map(opt => {
          const active = selected.includes(opt)
          return (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                border: active
                  ? '0.5px solid rgba(10,132,255,0.3)'
                  : '0.5px solid rgba(255,255,255,0.08)',
                background: active
                  ? 'rgba(10,132,255,0.15)'
                  : 'rgba(255,255,255,0.04)',
                color: active ? '#0a84ff' : '#8a8a8a',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Badge status ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RecentDoc['status'] }) {
  const map = {
    processing: { label: 'Indicizzazione…', color: '#ff9f0a', bg: 'rgba(255,159,10,0.1)' },
    ready:      { label: 'Pronto',          color: '#30d158', bg: 'rgba(48,209,88,0.1)'  },
    error:      { label: 'Errore',          color: '#ff453a', bg: 'rgba(255,69,58,0.1)'  },
  }
  const s = map[status]
  return (
    <span style={{
      fontSize: '11px',
      padding: '2px 8px',
      borderRadius: '20px',
      background: s.bg,
      color: s.color,
      border: `0.5px solid ${s.color}40`,
    }}>
      {s.label}
    </span>
  )
}

// ─── Input dark ───────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1a1a1a',
  border: '0.5px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '13px',
  color: '#f5f5f5',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#444',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  display: 'block',
  marginBottom: '6px',
}

const cardStyle: React.CSSProperties = {
  background: '#111',
  border: '0.5px solid rgba(255,255,255,0.06)',
  borderRadius: '14px',
  padding: '20px',
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function CaricaPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auth / ruolo
  const [roleChecked, setRoleChecked] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [userName, setUserName] = useState<string>('')

  // File
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Campi
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState<string[]>([])
  const [selectedProjectType, setSelectedProjectType] = useState<string[]>([])
  const [selectedTools, setSelectedTools] = useState<string[]>([])

  // Upload state
  const [step, setStep] = useState<UploadStep>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Coda recente
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([])
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Controllo ruolo ──────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      const role = user.user_metadata?.role ?? 'user'
      if (role !== 'contributor' && role !== 'admin') {
        router.replace('/')
        return
      }
      setUserId(user.id)
      setUserName(user.user_metadata?.full_name ?? user.email ?? '')
      setRoleChecked(true)
    })
  }, [])

  // ── Carica documenti recenti ─────────────────────────────────────────────

  const loadRecent = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('documents')
      .select('id, title, file_type, status, created_at')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)
    if (data) setRecentDocs(data as RecentDoc[])
  }, [userId])

  useEffect(() => {
    if (userId) loadRecent()
  }, [userId, loadRecent])

  // ── Polling status documenti in processing ────────────────────────────────

  useEffect(() => {
    const hasProcessing = recentDocs.some(d => d.status === 'processing')
    if (hasProcessing && !pollingRef.current) {
      pollingRef.current = setInterval(loadRecent, 3000)
    }
    if (!hasProcessing && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
      // Se l'ultimo upload è appena diventato ready, aggiorna step
      setStep(prev => prev === 'indexing' ? 'done' : prev)
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [recentDocs])

  // ── Gestione file ─────────────────────────────────────────────────────────

  function handleFile(f: File) {
    if (f.size > 50 * 1024 * 1024) {
      setErrorMsg('Il file supera i 50 MB.')
      return
    }
    setFile(f)
    setErrorMsg('')
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!file || !title.trim() || step !== 'idle') return
    setStep('uploading')
    setErrorMsg('')

    try {
      // 1. Upload su Storage
      const path = `${userId}/${Date.now()}_${file.name}`
      const { data: storageData, error: storageError } = await supabase
        .storage
        .from('documents')
        .upload(path, file)

      if (storageError) throw new Error(`Storage: ${storageError.message}`)

      // 2. Inserisci record in documents
      setStep('indexing')
      const { data: doc, error: dbError } = await supabase
        .from('documents')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          file_path: storageData.path,
          file_type: fileExt(file.name),
          industry: selectedIndustry,
          project_type: selectedProjectType,
          tools: selectedTools,
          author_name: userName,
          author_id: userId,
          status: 'processing',
        })
        .select()
        .single()

      if (dbError) throw new Error(`Database: ${dbError.message}`)

      // 3. Chiama Edge Function process-document
      await supabase.functions.invoke('process-document', {
        body: { document_id: doc.id },
      })

      // 4. Aggiorna lista recenti e avvia polling
      await loadRecent()

      // Reset form
      setFile(null)
      setTitle('')
      setDescription('')
      setSelectedIndustry([])
      setSelectedProjectType([])
      setSelectedTools([])

    } catch (err: any) {
      setStep('error')
      setErrorMsg(err.message ?? 'Errore durante il caricamento.')
    }
  }

  async function handleRetry(docId: string) {
    await supabase.functions.invoke('process-document', { body: { document_id: docId } })
    await supabase.from('documents').update({ status: 'processing' }).eq('id', docId)
    loadRecent()
  }

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!roleChecked) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '13px' }}>
        Verifica accesso…
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const canUpload = !!file && !!title.trim() && step === 'idle'
  const ext = file ? fileExt(file.name) : ''

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '32px 24px',
      backgroundColor: '#0a0a0a',
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#f5f5f5', margin: '0 0 4px' }}>
          Carica documento
        </h1>
        <p style={{ fontSize: '13px', color: '#444', margin: '0 0 28px' }}>
          Il file verrà indicizzato e reso disponibile nella chat.
        </p>

        {/* Due colonne */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>

          {/* ── Colonna sinistra ── */}
          <div style={cardStyle}>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              style={{
                border: isDragOver
                  ? '1.5px dashed rgba(10,132,255,0.4)'
                  : '1.5px dashed rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '32px 20px',
                textAlign: 'center',
                cursor: file ? 'default' : 'pointer',
                background: isDragOver ? 'rgba(10,132,255,0.04)' : 'transparent',
                transition: 'all 0.2s',
                marginBottom: '20px',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.pptx,.ppt"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />

              {file ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <FileText size={20} color={fileColor(ext)} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', color: '#f5f5f5', fontWeight: 500 }}>{file.name}</div>
                    <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>{formatBytes(file.size)}</div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null) }}
                    style={{
                      marginLeft: '8px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '0.5px solid rgba(255,255,255,0.08)',
                      borderRadius: '50%',
                      width: '22px',
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#8a8a8a',
                      flexShrink: 0,
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={24} color="#444" style={{ margin: '0 auto' }} />
                  <div style={{ fontSize: '13px', color: '#8a8a8a', marginTop: '8px' }}>
                    Trascina il file qui o{' '}
                    <span
                      onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                      style={{ color: '#0a84ff', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      sfoglia
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#444', marginTop: '4px' }}>
                    PDF, DOCX, PPTX · max 50 MB
                  </div>
                </>
              )}
            </div>

            {/* Titolo */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Titolo</label>
              <input
                style={inputStyle}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Titolo del documento"
              />
            </div>

            {/* Descrizione */}
            <div>
              <label style={labelStyle}>Descrizione</label>
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: '72px', lineHeight: 1.6 }}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Breve descrizione del contenuto"
                rows={3}
              />
            </div>
          </div>

          {/* ── Colonna destra ── */}
          <div style={cardStyle}>
            <PillGroup
              label="Industry"
              options={INDUSTRIES}
              selected={selectedIndustry}
              onChange={setSelectedIndustry}
            />
            <PillGroup
              label="Tipo progetto"
              options={PROJECT_TYPES}
              selected={selectedProjectType}
              onChange={setSelectedProjectType}
            />
            <PillGroup
              label="Tool"
              options={TOOLS}
              selected={selectedTools}
              onChange={setSelectedTools}
            />
          </div>
        </div>

        {/* ── Pulsante upload ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '24px', gap: '10px' }}>
          {step === 'uploading' && (
            <p style={{ fontSize: '13px', color: '#8a8a8a', margin: 0 }}>Caricamento file…</p>
          )}
          {step === 'indexing' && (
            <p style={{ fontSize: '13px', color: '#8a8a8a', margin: 0 }}>Indicizzazione in corso…</p>
          )}
          {step === 'done' && (
            <p style={{ fontSize: '13px', color: '#30d158', margin: 0 }}>Completato ✓</p>
          )}
          {step === 'error' && (
            <p style={{ fontSize: '13px', color: '#ff453a', margin: 0 }}>{errorMsg}</p>
          )}

          <button
            onClick={handleUpload}
            disabled={!canUpload}
            style={{
              background: canUpload ? '#0a84ff' : '#1a1a1a',
              color: canUpload ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 32px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: canUpload ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {step === 'uploading' || step === 'indexing' ? 'Caricamento…' : 'Carica e indicizza →'}
          </button>
        </div>

        {/* ── Coda documenti recenti ── */}
        {recentDocs.length > 0 && (
          <div style={{ marginTop: '40px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 500, color: '#8a8a8a', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Caricati di recente
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentDocs.map(doc => (
                <div
                  key={doc.id}
                  style={{
                    ...cardStyle,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <FileText size={16} color={fileColor(doc.file_type)} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: '#f5f5f5', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>
                      {formatDate(doc.created_at)}
                    </div>
                  </div>
                  <StatusBadge status={doc.status} />
                  {doc.status === 'error' && (
                    <button
                      onClick={() => handleRetry(doc.id)}
                      style={{
                        background: 'rgba(255,69,58,0.1)',
                        border: '0.5px solid rgba(255,69,58,0.2)',
                        borderRadius: '6px',
                        color: '#ff453a',
                        fontSize: '12px',
                        padding: '3px 10px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        marginLeft: '6px',
                      }}
                    >
                      ↺ Riprova
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
