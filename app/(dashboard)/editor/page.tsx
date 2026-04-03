'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Costanti ─────────────────────────────────────────────────────────────────

const TEMPLATE = `## Scheda documento
- **Tipo:** Know-how funzionale
- **Area:**
- **Industry:**
- **Quando usare:**
- **Tool tipici:**

---

## Cos'è e a cosa serve

---

## Concetti chiave

### [titolo sezione]

---

## KPI da monitorare
- **Nome KPI** = formula · interpretazione

---

## Domande tipiche di progetto
-

---

## Connessioni con altri nodi
→

---

## Tag
- Industry:
- Tipo progetto:
- Tool: `

type ViewMode = 'write' | 'preview' | 'split'

// ─── Markdown renderer (no deps) ─────────────────────────────────────────────

const S = {
  h1: 'font-size:22px;font-weight:600;color:#f5f5f5;margin:24px 0 12px;padding-bottom:8px;border-bottom:0.5px solid rgba(255,255,255,0.06)',
  h2: 'font-size:17px;font-weight:600;color:#f5f5f5;margin:20px 0 8px',
  h3: 'font-size:14px;font-weight:500;color:#8a8a8a;margin:16px 0 6px',
  p:  'font-size:13px;color:#8a8a8a;line-height:1.8;margin-bottom:10px',
  ul: 'padding-left:16px;margin-bottom:10px',
  li: 'font-size:13px;color:#8a8a8a;line-height:1.8',
  strong: 'color:#f5f5f5;font-weight:500',
  code: 'font-family:monospace;font-size:12px;background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:4px;color:#0a84ff',
  pre: 'background:rgba(255,255,255,0.04);border-radius:8px;padding:14px 16px;overflow-x:auto;margin-bottom:12px',
  preCode: 'font-family:monospace;font-size:12px;color:#e5e5e5',
  hr: 'border:none;border-top:0.5px solid rgba(255,255,255,0.08);margin:20px 0',
}

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Fenced code blocks (before inline code)
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, (_, code) =>
    `<pre style="${S.pre}"><code style="${S.preCode}">${code.trim()}</code></pre>`
  )

  // HR
  html = html.replace(/^---$/gm, `<hr style="${S.hr}"/>`)

  // Headings
  html = html.replace(/^### (.+)$/gm, `<h3 style="${S.h3}">$1</h3>`)
  html = html.replace(/^## (.+)$/gm,  `<h2 style="${S.h2}">$1</h2>`)
  html = html.replace(/^# (.+)$/gm,   `<h1 style="${S.h1}">$1</h1>`)

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, `<strong style="${S.strong}">$1</strong>`)

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  // Inline code
  html = html.replace(/`([^`]+)`/g, `<code style="${S.code}">$1</code>`)

  // Arrow
  html = html.replace(/→/g, '<span style="color:#0a84ff">→</span>')

  // Unordered lists
  html = html.replace(/(^- .+(\n- .+)*)/gm, (block) => {
    const items = block
      .split('\n')
      .filter(l => l.startsWith('- '))
      .map(l => `<li style="${S.li}">${l.slice(2)}</li>`)
      .join('')
    return `<ul style="${S.ul}">${items}</ul>`
  })

  // Paragraphs
  const lines = html.split('\n')
  const out: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (
      line.startsWith('<h') ||
      line.startsWith('<ul') ||
      line.startsWith('<pre') ||
      line.startsWith('<hr') ||
      line === ''
    ) {
      out.push(line)
    } else {
      out.push(`<p style="${S.p}">${line}</p>`)
    }
  }

  return out.join('\n')
}

// ─── Stili condivisi ──────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.08)',
  borderRadius: '6px',
  padding: '4px 8px',
  fontSize: '11px',
  color: '#8a8a8a',
  fontFamily: 'inherit',
  cursor: 'pointer',
  outline: 'none',
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function EditorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Auth
  const [roleChecked, setRoleChecked] = useState(false)
  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('')

  // Doc state
  const [docId, setDocId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [industry, setIndustry] = useState('Tutte')
  const [projectType, setProjectType] = useState('Analytics')
  const [tool, setTool] = useState('PowerBI')

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('write')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [toast, setToast] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autosaveTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSavedContent = useRef('')

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

  // ── Carica documento esistente da ?id= ───────────────────────────────────

  useEffect(() => {
    const id = searchParams.get('id')
    if (!id || !roleChecked) return

    supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDocId(data.id)
          setTitle(data.title ?? '')
          setContent(data.content_markdown ?? '')
          setIndustry(data.industry?.[0] ?? 'Tutte')
          setProjectType(data.project_type?.[0] ?? 'Analytics')
          setTool(data.tools?.[0] ?? 'PowerBI')
          lastSavedContent.current = data.content_markdown ?? ''
        }
      })
  }, [roleChecked])

  // ── Dirty tracking ───────────────────────────────────────────────────────

  useEffect(() => {
    setIsDirty(content !== lastSavedContent.current || title !== '')
  }, [content, title])

  // ── Autosave ogni 30s ────────────────────────────────────────────────────

  const saveDraft = useCallback(async (silent = false) => {
    if (!title.trim() && !content.trim()) return

    const payload = {
      title: title.trim() || 'Senza titolo',
      content_markdown: content,
      industry: [industry],
      project_type: [projectType],
      tools: [tool],
      author_name: userName,
      author_id: userId,
      status: 'draft',
      file_type: 'md',
      updated_at: new Date().toISOString(),
    }

    if (docId) {
      await supabase.from('documents').update(payload).eq('id', docId)
    } else {
      const { data } = await supabase
        .from('documents')
        .insert({ ...payload })
        .select('id')
        .single()
      if (data?.id) setDocId(data.id)
    }

    lastSavedContent.current = content
    setIsDirty(false)
    setSavedAt(new Date())

    if (!silent) {
      setToast('Bozza salvata')
      setTimeout(() => setToast(''), 2500)
    }
  }, [title, content, industry, projectType, tool, userId, userName, docId])

  useEffect(() => {
    if (!roleChecked) return
    autosaveTimer.current = setInterval(() => {
      if (isDirty) saveDraft(true)
    }, 30000)
    return () => {
      if (autosaveTimer.current) clearInterval(autosaveTimer.current)
    }
  }, [roleChecked, isDirty, saveDraft])

  // ── Pubblica ─────────────────────────────────────────────────────────────

  async function handlePublish() {
    if (!title.trim()) { setToast('Inserisci un titolo'); setTimeout(() => setToast(''), 2500); return }

    setToast('Pubblicazione in corso...')

    const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const path = `${userId}/${Date.now()}_${slug}.md`

    // Upload file .md su Storage
    const blob = new Blob([content], { type: 'text/markdown' })
    const { data: storageData, error: storageError } = await supabase.storage
      .from('documents')
      .upload(path, blob)

    if (storageError) {
      setToast(`Errore: ${storageError.message}`)
      setTimeout(() => setToast(''), 3000)
      return
    }

    const docPayload = {
      title: title.trim(),
      content_markdown: content,
      file_path: storageData.path,
      file_type: 'md',
      industry: [industry],
      project_type: [projectType],
      tools: [tool],
      author_name: userName,
      author_id: userId,
      status: 'processing',
    }

    let publishedId = docId
    if (publishedId) {
      await supabase.from('documents').update(docPayload).eq('id', publishedId)
    } else {
      const { data } = await supabase
        .from('documents')
        .insert(docPayload)
        .select('id')
        .single()
      publishedId = data?.id ?? null
    }

    if (publishedId) {
      await supabase.functions.invoke('process-document', {
        body: { document_id: publishedId },
      })
    }

    setTimeout(() => router.push('/'), 1000)
  }

  // ── Toolbar helpers ───────────────────────────────────────────────────────

  function insertAtCursor(before: string, after = '') {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = content.slice(start, end)
    const newContent =
      content.slice(0, start) + before + selected + after + content.slice(end)
    setContent(newContent)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(
        start + before.length,
        start + before.length + selected.length
      )
    }, 0)
  }

  function insertLine(prefix: string) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const lineStart = content.lastIndexOf('\n', start - 1) + 1
    const newContent = content.slice(0, lineStart) + prefix + content.slice(lineStart)
    setContent(newContent)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length)
    }, 0)
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const chunkEstimate = Math.round(wordCount / 55)

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!roleChecked) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '13px' }}>
        Verifica accesso…
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0a0a0a', overflow: 'hidden' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '16px', right: '16px', zIndex: 9999,
          background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', padding: '10px 16px', fontSize: '13px', color: '#f5f5f5',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {toast}
        </div>
      )}

      {/* ── Topbar ── */}
      <div style={{
        height: '48px', flexShrink: 0,
        background: '#111',
        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
        padding: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      }}>
        {/* Titolo inline */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Titolo documento..."
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '15px', fontWeight: 600, color: '#f5f5f5',
            fontFamily: 'inherit', width: '300px',
          }}
        />

        {/* Metadati + azioni */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <select value={industry} onChange={e => setIndustry(e.target.value)} style={selectStyle}>
            {['Tutte', 'Manufacturing', 'Food & Bev.', 'Pharma', 'Retail', 'Finance'].map(o =>
              <option key={o} value={o}>{o}</option>
            )}
          </select>

          <select value={projectType} onChange={e => setProjectType(e.target.value)} style={selectStyle}>
            {['Analytics', 'OEE', 'P&L', 'Traceability', 'Budget', 'Scheduling'].map(o =>
              <option key={o} value={o}>{o}</option>
            )}
          </select>

          <select value={tool} onChange={e => setTool(e.target.value)} style={selectStyle}>
            {['PowerBI', 'Qlik', 'QuickSight', 'Excel'].map(o =>
              <option key={o} value={o}>{o}</option>
            )}
          </select>

          <div style={{ width: '0.5px', height: '20px', background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

          <button
            onClick={() => saveDraft(false)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: '7px', padding: '5px 12px',
              fontSize: '12px', color: '#8a8a8a',
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            Salva bozza
          </button>

          <button
            onClick={handlePublish}
            style={{
              background: '#0a84ff', color: 'white', border: 'none',
              borderRadius: '7px', padding: '5px 14px',
              fontSize: '12px', fontWeight: 500,
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            Pubblica →
          </button>
        </div>
      </div>

      {/* ── Toolbar markdown ── */}
      <div style={{
        height: '36px', flexShrink: 0,
        background: '#0d0d0d',
        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
        padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: '2px',
      }}>
        {[
          { label: 'B',  action: () => insertAtCursor('**', '**') },
          { label: 'I',  action: () => insertAtCursor('*', '*') },
          { label: '`',  action: () => insertAtCursor('`', '`') },
        ].map(btn => (
          <ToolbarBtn key={btn.label} label={btn.label} onClick={btn.action} mono />
        ))}

        <ToolbarSep />

        {[
          { label: 'H1', action: () => insertLine('# ') },
          { label: 'H2', action: () => insertLine('## ') },
          { label: 'H3', action: () => insertLine('### ') },
        ].map(btn => (
          <ToolbarBtn key={btn.label} label={btn.label} onClick={btn.action} mono />
        ))}

        <ToolbarSep />

        <ToolbarBtn label="—" onClick={() => insertLine('---\n')} mono />
        <ToolbarBtn label="lista" onClick={() => insertLine('- ')} mono />

        <ToolbarSep />

        <ToolbarBtn
          label="+ template"
          onClick={() => {
            setContent(prev => prev ? prev + '\n\n' + TEMPLATE : TEMPLATE)
          }}
          mono
        />
      </div>

      {/* ── Area principale ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          padding: '0 16px', height: '32px', flexShrink: 0,
          borderBottom: '0.5px solid rgba(255,255,255,0.04)',
        }}>
          {(['write', 'preview', 'split'] as ViewMode[]).map(mode => {
            const labels: Record<ViewMode, string> = { write: 'Scrivi', preview: 'Anteprima', split: 'Split' }
            const active = viewMode === mode
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  background: 'transparent', border: 'none',
                  padding: '4px 10px', fontSize: '11px',
                  color: active ? '#f5f5f5' : '#444',
                  borderBottom: active ? '1.5px solid #0a84ff' : '1.5px solid transparent',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'color 0.1s',
                }}
              >
                {labels[mode]}
              </button>
            )
          })}
        </div>

        {/* Pannelli */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Editor */}
          {(viewMode === 'write' || viewMode === 'split') && (
            <div style={{
              flex: 1,
              borderRight: viewMode === 'split' ? '0.5px solid rgba(255,255,255,0.06)' : 'none',
              display: 'flex',
            }}>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Inizia a scrivere..."
                style={{
                  flex: 1, width: '100%',
                  background: '#0a0a0a', border: 'none', outline: 'none', resize: 'none',
                  padding: '24px 32px',
                  fontSize: '13px',
                  fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace",
                  color: '#e5e5e5', lineHeight: 1.8,
                  caretColor: '#0a84ff',
                }}
              />
            </div>
          )}

          {/* Preview */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '24px 32px',
              background: '#0a0a0a',
            }}>
              <div
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                style={{ maxWidth: '680px' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        height: '32px', flexShrink: 0,
        background: '#0d0d0d',
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
        padding: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '11px', color: '#333' }}>
          {wordCount} {wordCount === 1 ? 'parola' : 'parole'} · {chunkEstimate} chunk stimati
        </span>
        <span style={{ fontSize: '11px', color: '#333', display: 'flex', alignItems: 'center', gap: '5px' }}>
          {savedAt && (
            <>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#30d158', display: 'inline-block' }} />
              Salvato
            </>
          )}
        </span>
      </div>
    </div>
  )
}

// ─── Toolbar subcomponents ────────────────────────────────────────────────────

function ToolbarBtn({
  label, onClick, mono,
}: {
  label: string
  onClick: () => void
  mono?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: 'none', borderRadius: '5px',
        padding: '4px 8px', fontSize: '12px',
        color: hover ? '#f5f5f5' : '#555',
        fontFamily: mono ? "'SF Mono', 'Monaco', monospace" : 'inherit',
        cursor: 'pointer', transition: 'all 0.1s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function ToolbarSep() {
  return (
    <div style={{
      width: '0.5px', height: '16px',
      background: 'rgba(255,255,255,0.08)',
      margin: '0 6px', flexShrink: 0,
    }} />
  )
}
