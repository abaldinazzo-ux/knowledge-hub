'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import {
  MessageSquare,
  Upload,
  FileEdit,
  Archive,
  Network,
  GitBranch,
  LogOut,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'

type Role = 'user' | 'contributor' | 'admin' | string

interface SidebarProps {
  role: Role
  displayName: string
}

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  contributorOnly?: boolean
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: 'CONSULTA',
    items: [
      { label: 'Chat AI', href: '/', icon: MessageSquare },
    ],
  },
  {
    title: 'CONTRIBUISCI',
    items: [
      { label: 'Carica documento', href: '/carica', icon: Upload, contributorOnly: true },
      { label: 'Editor interno', href: '/editor', icon: FileEdit, contributorOnly: true },
      { label: 'Archivio', href: '/archivio', icon: Archive, contributorOnly: true },
    ],
  },
  {
    title: 'ANALISI',
    items: [
      { label: 'Intervista', href: '/intervista', icon: Network, contributorOnly: true },
      { label: 'Mappe mentali', href: '/mappe', icon: GitBranch, contributorOnly: true },
    ],
  },
]

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div
      style={{
        width: '28px',
        height: '28px',
        minWidth: '28px',
        borderRadius: '50%',
        backgroundColor: 'rgba(10,132,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: 600,
        color: '#0a84ff',
      }}
    >
      {initials || '?'}
    </div>
  )
}

function RoleBadge({ role }: { role: Role }) {
  if (role === 'admin') {
    return (
      <span
        style={{
          fontSize: '10px',
          fontWeight: 500,
          padding: '1px 6px',
          borderRadius: '99px',
          backgroundColor: 'rgba(255,214,10,0.12)',
          color: '#ffd60a',
        }}
      >
        admin
      </span>
    )
  }
  if (role === 'contributor') {
    return (
      <span
        style={{
          fontSize: '10px',
          fontWeight: 500,
          padding: '1px 6px',
          borderRadius: '99px',
          backgroundColor: 'rgba(10,132,255,0.12)',
          color: '#0a84ff',
        }}
      >
        contributor
      </span>
    )
  }
  return null
}

export default function Sidebar({ role, displayName }: SidebarProps) {
  const pathname = usePathname()
  const canAccess = role === 'contributor' || role === 'admin'
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(() => logout())
  }

  return (
    <aside
      style={{
        width: '200px',
        minWidth: '200px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        backgroundColor: '#111111',
        borderRight: '0.5px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 14px 12px',
          borderBottom: '0.5px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#f5f5f5',
            letterSpacing: '-0.2px',
            lineHeight: 1.3,
          }}
        >
          Knowledge Hub
        </div>
        <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>
          by Horsa Insight
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: '8px' }}>
        {sections.map(section => {
          const visibleItems = section.items.filter(
            item => !item.contributorOnly || canAccess
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={section.title}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#444',
                  padding: '12px 14px 4px',
                }}
              >
                {section.title}
              </div>
              {visibleItems.map(item => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 14px',
                      borderRadius: 0,
                      fontSize: '12px',
                      color: isActive ? '#0a84ff' : '#8a8a8a',
                      backgroundColor: isActive
                        ? 'rgba(10,132,255,0.12)'
                        : 'transparent',
                      textDecoration: 'none',
                      transition: 'background-color 0.1s, color 0.1s',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        const el = e.currentTarget
                        el.style.backgroundColor = 'rgba(255,255,255,0.04)'
                        el.style.color = '#f5f5f5'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        const el = e.currentTarget
                        el.style.backgroundColor = 'transparent'
                        el.style.color = '#8a8a8a'
                      }
                    }}
                  >
                    <Icon size={13} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Footer utente */}
      <div
        style={{
          borderTop: '0.5px solid rgba(255,255,255,0.06)',
          padding: '12px 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <UserAvatar name={displayName} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '12px',
                color: '#8a8a8a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </div>
            <div style={{ marginTop: '3px' }}>
              <RoleBadge role={role} />
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={isPending}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            width: '100%',
            padding: '6px 8px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#444',
            fontSize: '11px',
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            transition: 'background-color 0.1s, color 0.1s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'rgba(255,59,48,0.08)'
            e.currentTarget.style.color = 'rgba(255,99,88,0.9)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#444'
          }}
        >
          <LogOut size={12} strokeWidth={1.8} />
          {isPending ? 'Uscita…' : 'Logout'}
        </button>
      </div>
    </aside>
  )
}
