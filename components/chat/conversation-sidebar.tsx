'use client'

import { useState } from 'react'

export interface Conversation {
  id: string
  title: string
  created_at: string
}

interface ConversationSidebarProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

function groupByDate(convs: Conversation[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Oggi', items: [] },
    { label: 'Ieri', items: [] },
    { label: 'Questa settimana', items: [] },
  ]

  for (const c of convs) {
    const d = new Date(c.created_at)
    d.setHours(0, 0, 0, 0)
    if (d.getTime() === today.getTime()) {
      groups[0].items.push(c)
    } else if (d.getTime() === yesterday.getTime()) {
      groups[1].items.push(c)
    } else if (d >= weekAgo) {
      groups[2].items.push(c)
    }
  }

  return groups.filter(g => g.items.length > 0)
}

export default function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: ConversationSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const groups = groupByDate(conversations)

  return (
    <div
      style={{
        width: '220px',
        flexShrink: 0,
        backgroundColor: '#0d0d0d',
        borderRight: '0.5px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* New conversation button */}
      <div style={{ padding: '12px 14px', flexShrink: 0 }}>
        <button
          onClick={onNew}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.06)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '7px 12px',
            fontSize: '12px',
            color: '#8a8a8a',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
            transition: 'color 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f5f5f5')}
          onMouseLeave={e => (e.currentTarget.style.color = '#8a8a8a')}
        >
          + Nuova conversazione
        </button>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {groups.length === 0 && (
          <div
            style={{
              padding: '8px 14px',
              fontSize: '12px',
              color: '#333',
            }}
          >
            Nessuna conversazione
          </div>
        )}
        {groups.map(group => (
          <div key={group.label}>
            <div
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                color: '#333',
                padding: '8px 14px 4px',
                letterSpacing: '0.06em',
                fontWeight: 600,
              }}
            >
              {group.label}
            </div>
            {group.items.map(conv => {
              const isActive = conv.id === activeId
              const isHovered = conv.id === hoveredId
              return (
                <div
                  key={conv.id}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 14px',
                    cursor: 'pointer',
                    backgroundColor: isActive
                      ? 'rgba(255,255,255,0.06)'
                      : isHovered
                      ? 'rgba(255,255,255,0.04)'
                      : 'transparent',
                    transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={() => setHoveredId(conv.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onSelect(conv.id)}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: '12px',
                      color: isActive || isHovered ? '#f5f5f5' : '#8a8a8a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      paddingRight: isHovered ? '20px' : '0',
                      transition: 'color 0.1s',
                    }}
                  >
                    {conv.title || 'Nuova conversazione'}
                  </span>
                  {isHovered && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        onDelete(conv.id)
                      }}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        width: '16px',
                        height: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: '#333',
                        borderRadius: '3px',
                        padding: 0,
                        lineHeight: 1,
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ff453a')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#333')}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
