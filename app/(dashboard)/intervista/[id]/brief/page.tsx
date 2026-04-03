'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Markdown renderer (light mode) ──────────────────────────────────────────

function renderBriefMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="font-family:monospace;font-size:13px;background:#f0f0f0;padding:1px 5px;border-radius:3px;color:#1a1a1a">$1</code>')
  // HR
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/>')
  // Headings
  html = html.replace(/^# (.+)$/gm,   '<h1 style="font-size:28px;font-weight:700;color:#1a1a1a;margin:0 0 8px;line-height:1.2">$1</h1>')
  html = html.replace(/^## (.+)$/gm,  '<h2 style="font-size:18px;font-weight:600;color:#1a1a1a;margin:32px 0 10px;padding-bottom:6px;border-bottom:1px solid #e5e5e5">$1</h2>')
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:600;color:#333;margin:20px 0 8px">$1</h3>')
  // Unordered lists
  html = html.replace(/(^- .+(\n- .+)*)/gm, (block) => {
    const items = block
      .split('\n')
      .filter(l => l.startsWith('- '))
      .map(l => `<li style="font-size:14px;color:#444;line-height:1.8;margin-bottom:2px">${l.slice(2)}</li>`)
      .join('')
    return `<ul style="padding-left:20px;margin:8px 0">${items}</ul>`
  })
  // Paragraphs
  const lines = html.split('\n')
  const out: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { out.push(''); continue }
    if (line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('<hr')) {
      out.push(line)
    } else {
      out.push(`<p style="font-size:14px;color:#444;line-height:1.8;margin-bottom:8px">${line}</p>`)
    }
  }
  return out.join('\n')
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function BriefPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const sessionId = params.id as string

  const [brief, setBrief] = useState('')
  const [sessionTitle, setSessionTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: userRes } = await supabase.auth.getUser()
      if (!userRes.user) { router.replace('/login'); return }
      setAuthor(userRes.user.user_metadata?.full_name ?? userRes.user.email ?? '')

      const { data: session } = await supabase
        .from('interview_sessions')
        .select('title, brief_markdown')
        .eq('id', sessionId)
        .single()

      if (session) {
        setSessionTitle(session.title ?? '')
        setBrief(session.brief_markdown ?? '')
      }
      setReady(true)
    }
    load()
  }, [sessionId])

  if (!ready) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '14px', background: 'white' }}>
        Caricamento brief…
      </div>
    )
  }

  const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'white', minHeight: '100%' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 32px' }}>

        {/* Barra azioni (non stampata) */}
        <div
          className="no-print"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}
        >
          <button
            onClick={() => router.push(`/intervista/${sessionId}/canvas`)}
            style={{ background: 'transparent', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', color: '#666', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ← Torna al canvas
          </button>
          <button
            onClick={() => window.print()}
            style={{ background: '#1a1a1a', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
          >
            ⬇ Stampa
          </button>
        </div>

        {/* Header documento */}
        <div style={{ marginBottom: '8px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 6px' }}>
            Brief — {sessionTitle}
          </h1>
          <div style={{ fontSize: '14px', color: '#888' }}>
            {today} · {author}
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e5e5e5', margin: '24px 0' }} />

        {/* Contenuto brief */}
        {brief ? (
          <div dangerouslySetInnerHTML={{ __html: renderBriefMarkdown(brief) }} />
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>Brief non ancora generato</div>
            <button
              onClick={() => router.push(`/intervista/${sessionId}/canvas`)}
              style={{ background: '#1a1a1a', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Torna al canvas per generarlo
            </button>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  )
}
