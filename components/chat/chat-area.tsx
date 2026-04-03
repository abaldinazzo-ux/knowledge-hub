'use client'

import { useState, useRef, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { SourceData } from './source-panel'

const CORPUS_FILTERS = ['Tutti', 'Manufacturing', 'OEE', 'Finance', 'Retail', 'Pharma'] as const
type Filter = (typeof CORPUS_FILTERS)[number]

const SUGGESTIONS = [
  'Da dove parto per un progetto OEE nel manufacturing?',
  'Quali KPI uso per analizzare la marginalità retail?',
  'Come si calcola il BEP per una linea prodotto?',
  'Differenza tra costi fissi e variabili nel CE',
]

export interface Source {
  id: string
  title: string
  chunk_content: string
  section?: string
  author?: string
  format?: string
  date?: string
  download_url?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: Source[]
  isStreaming?: boolean
}

interface ChatAreaProps {
  conversationId: string | null
  conversationTitle: string
  onConversationCreated: (id: string, title: string) => void
  onOpenSource: (source: SourceData) => void
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: '4px', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#444',
            animation: `bounce 0.8s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

function BlinkCursor() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '2px',
        height: '14px',
        background: '#f5f5f5',
        marginLeft: '2px',
        verticalAlign: 'middle',
        animation: 'blink 1s ease-in-out infinite',
      }}
    />
  )
}

export default function ChatArea({
  conversationId,
  conversationTitle,
  onConversationCreated,
  onOpenSource,
}: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState<Filter>('Tutti')
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeConvId, setActiveConvId] = useState<string | null>(conversationId)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  console.log('ChatArea render, messages:', messages.length, '| conversationId:', conversationId, '| activeConvId:', activeConvId, '| isStreaming:', isStreaming)

  useEffect(() => {
    console.log('useEffect [conversationId, isStreaming] triggered, conversationId:', conversationId, 'isStreaming:', isStreaming)
    if (!conversationId || isStreaming) return

    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (data) setMessages(data.map((m: Record<string, unknown>) => ({
        id: m.id as string,
        role: m.role as 'user' | 'assistant',
        content: m.content as string,
        sources: (m.sources as Source[]) ?? [],
        isStreaming: false,
      })))
    }

    loadMessages()
  }, [conversationId, isStreaming])

  useEffect(() => {
    console.log('useEffect [messages] triggered (scroll), messages:', messages.length)
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return

    setIsStreaming(true)

    // Aggiungi messaggio utente
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      sources: [],
    }
    setMessages(prev => [...prev, userMessage])
    console.log('Messages after adding userMessage:', messages.length, '(nota: valore stale, il vero sarà +1)')
    setInput('')

    let convId = activeConvId
    console.log('convId at start of sendMessage:', convId)

    // Create conversation if needed
    if (!convId) {
      const { data: user } = await supabase.auth.getUser()
      const { data: conv } = await supabase
        .from('conversations')
        .insert({
          user_id: user.user?.id,
          title: text.substring(0, 40),
        })
        .select('id')
        .single()

      if (conv) {
        convId = conv.id
        setActiveConvId(convId)
        console.log('New conversation created, convId:', convId, '— calling onConversationCreated')
        onConversationCreated(conv.id, text.substring(0, 40))
      }
    }

    // Aggiungi bubble AI vuota
    const aiMessageId = crypto.randomUUID()
    const aiMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      sources: [],
      isStreaming: true,
    }
    setMessages(prev => [...prev, aiMessage])
    console.log('Messages after adding aiMessage bubble')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversation_id: convId,
          filter,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Decodifica il chunk e aggiungilo al buffer
        buffer += decoder.decode(value, { stream: true })

        // Processa le righe complete nel buffer
        const lines = buffer.split('\n')

        // L'ultima riga potrebbe essere incompleta, la teniamo nel buffer
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const jsonStr = trimmed.slice(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') continue

          try {
            const parsed = JSON.parse(jsonStr)
            console.log('SSE event:', parsed.type)

            if (parsed.type === 'sources') {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, sources: parsed.sources || [] }
                    : msg
                )
              )
            }

            if (parsed.type === 'delta' && parsed.text) {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, content: msg.content + parsed.text }
                    : msg
                )
              )
            }

            if (parsed.type === 'done') {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, isStreaming: false }
                    : msg
                )
              )
              setIsStreaming(false)
            }
          } catch (e) {
            console.error('SSE parse error:', e, 'Raw:', jsonStr)
          }
        }
      }
    } catch (error) {
      console.error('Send message error:', error)
      // Rimuovi la bubble AI vuota in caso di errore
      setMessages(prev => prev.filter(msg => msg.id !== aiMessageId))
    } finally {
      setIsStreaming(false)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        backgroundColor: '#0a0a0a',
        overflow: 'hidden',
      }}
    >
      {/* Topbar */}
      <div
        style={{
          height: '44px',
          flexShrink: 0,
          backgroundColor: '#111',
          borderBottom: '0.5px solid rgba(255,255,255,0.06)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#f5f5f5',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {conversationTitle}
        </span>

        {/* Corpus filter pills */}
        <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
          {CORPUS_FILTERS.map(f => {
            const isActive = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  border: isActive
                    ? '0.5px solid rgba(10,132,255,0.3)'
                    : '0.5px solid rgba(255,255,255,0.08)',
                  background: isActive
                    ? 'rgba(10,132,255,0.15)'
                    : 'rgba(255,255,255,0.06)',
                  color: isActive ? '#0a84ff' : '#8a8a8a',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.1s',
                }}
              >
                {f}
              </button>
            )
          })}
        </div>
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {isEmpty ? (
          /* Empty state */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100%',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 500,
                color: '#f5f5f5',
                margin: 0,
              }}
            >
              Cosa vuoi sapere?
            </h2>
            <p
              style={{
                fontSize: '13px',
                color: '#444',
                marginTop: '8px',
                marginBottom: '24px',
              }}
            >
              Fai una domanda al knowledge base.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
              }}
            >
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    width: '200px',
                    background: '#111',
                    border: '0.5px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    fontSize: '12px',
                    color: '#8a8a8a',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                    transition: 'border-color 0.1s, color 0.1s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                    e.currentTarget.style.color = '#f5f5f5'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                    e.currentTarget.style.color = '#8a8a8a'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: msg.role === 'user' ? '70%' : '80%',
              }}
            >
              {msg.role === 'user' ? (
                <div
                  style={{
                    background: '#0a84ff',
                    color: 'white',
                    borderRadius: '18px 18px 4px 18px',
                    padding: '10px 14px',
                    fontSize: '14px',
                    lineHeight: 1.6,
                  }}
                >
                  {msg.content}
                </div>
              ) : (
                <>
                  {/* AI label */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '6px',
                    }}
                  >
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#30d158',
                        animation: 'pulse 2s ease-in-out infinite',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: '11px', color: '#444' }}>
                      Knowledge Hub
                    </span>
                  </div>

                  {/* AI bubble */}
                  <div
                    style={{
                      background: '#111',
                      border: '0.5px solid rgba(255,255,255,0.08)',
                      borderRadius: '18px 18px 18px 4px',
                      padding: '12px 16px',
                      fontSize: '14px',
                      lineHeight: 1.7,
                      color: '#f5f5f5',
                    }}
                  >
                    {msg.content.length === 0 && msg.isStreaming ? (
                      <TypingIndicator />
                    ) : (
                      <>
                        {msg.content}
                        {msg.isStreaming && <BlinkCursor />}
                      </>
                    )}
                  </div>

                  {/* Sources chips */}
                  {!msg.isStreaming && msg.sources && msg.sources.length > 0 && (
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '5px',
                          marginTop: '8px',
                        }}
                      >
                        {msg.sources.map((src, i) => (
                          <button
                            key={i}
                            onClick={() => onOpenSource(src)}
                            style={{
                              fontSize: '11px',
                              padding: '3px 10px',
                              borderRadius: '20px',
                              background: 'rgba(10,132,255,0.08)',
                              border: '0.5px solid rgba(10,132,255,0.15)',
                              color: '#0a84ff',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e =>
                              (e.currentTarget.style.background =
                                'rgba(10,132,255,0.15)')
                            }
                            onMouseLeave={e =>
                              (e.currentTarget.style.background =
                                'rgba(10,132,255,0.08)')
                            }
                          >
                            {src.title.length > 30
                              ? src.title.substring(0, 30) + '…'
                              : src.title}
                          </button>
                        ))}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#333',
                          marginTop: '6px',
                        }}
                      >
                        Risposta basata su {msg.sources.length}{' '}
                        {msg.sources.length === 1
                          ? 'documento indicizzato'
                          : 'documenti indicizzati'}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          backgroundColor: '#111',
          borderTop: '0.5px solid rgba(255,255,255,0.06)',
          padding: '12px 16px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#1a1a1a',
            border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: '22px',
            padding: '10px 12px 10px 16px',
            gap: '8px',
          }}
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                console.log('enter pressed')
                sendMessage(input)
              }
            }}
            placeholder="Fai una domanda al knowledge base..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              color: '#f5f5f5',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => { console.log('send button clicked'); sendMessage(input) }}
            disabled={!input.trim() || isStreaming}
            style={{
              width: '30px',
              height: '30px',
              flexShrink: 0,
              borderRadius: '50%',
              background: !input.trim() || isStreaming ? '#1a1a1a' : '#0a84ff',
              color: !input.trim() || isStreaming ? '#333' : 'white',
              border: 'none',
              cursor: !input.trim() || isStreaming ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.1s, color 0.1s',
            }}
          >
            <ArrowUp size={14} strokeWidth={2} />
          </button>
        </div>
        <div
          style={{
            fontSize: '11px',
            color: '#222',
            textAlign: 'center',
            marginTop: '6px',
          }}
        >
          I risultati citano sempre la fonte · Clicca su una fonte per aprire il documento
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        input::placeholder {
          color: #333;
        }
      `}</style>
    </div>
  )
}
