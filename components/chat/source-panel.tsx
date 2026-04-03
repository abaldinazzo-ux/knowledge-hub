'use client'

export interface SourceData {
  title: string
  chunk_content: string
  section?: string
  author?: string
  format?: string
  date?: string
  download_url?: string
}

interface SourcePanelProps {
  source: SourceData | null
  isOpen: boolean
  onClose: () => void
}

export default function SourcePanel({ source, isOpen, onClose }: SourcePanelProps) {
  return (
    <div
      style={{
        width: isOpen ? '280px' : '0',
        flexShrink: 0,
        backgroundColor: '#111',
        borderLeft: '0.5px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Fixed-width inner container to prevent content reflow */}
      <div style={{ width: '280px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '0.5px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
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
              marginRight: '8px',
            }}
          >
            {source?.title ?? ''}
          </span>
          <button
            onClick={onClose}
            style={{
              width: '22px',
              height: '22px',
              flexShrink: 0,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              color: '#8a8a8a',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              lineHeight: 1,
              fontFamily: 'inherit',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e =>
              (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')
            }
            onMouseLeave={e =>
              (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')
            }
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {source && (
            <>
              {/* Relevant passage */}
              <div>
                <div
                  style={{
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    color: '#444',
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  Passaggio rilevante
                </div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '0.5px solid rgba(255,255,255,0.06)',
                    borderLeft: '2px solid #0a84ff',
                    borderRadius: '0 8px 8px 0',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: '#8a8a8a',
                    lineHeight: 1.6,
                  }}
                >
                  {source.chunk_content}
                </div>
                {source.section && (
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#333',
                      marginTop: '6px',
                    }}
                  >
                    Sezione: {source.section}
                  </div>
                )}
              </div>

              {/* Document info */}
              <div>
                <div
                  style={{
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    color: '#444',
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  Documento
                </div>
                <div
                  style={{ fontSize: '13px', fontWeight: 500, color: '#f5f5f5' }}
                >
                  {source.title}
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#444',
                    marginTop: '4px',
                  }}
                >
                  {[source.author, source.format, source.date]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>

              {/* Download button */}
              {source.download_url && (
                <a
                  href={source.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: '4px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '0.5px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '8px',
                    fontSize: '12px',
                    color: '#8a8a8a',
                    textAlign: 'center',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.1s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f5f5f5')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#8a8a8a')}
                >
                  Scarica originale
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
