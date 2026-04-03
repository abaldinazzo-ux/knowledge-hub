'use client'

import { useState, useTransition } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [btnHover, setBtnHover] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await login(formData)
      if (result?.error) {
        setError('Email o password non corretti. Riprova.')
      }
    })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          backgroundColor: '#111111',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '32px',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#f5f5f5',
              margin: '0 0 4px 0',
              letterSpacing: '-0.3px',
            }}
          >
            Knowledge Hub
          </h1>
          <p style={{ fontSize: '13px', color: '#444', margin: 0 }}>
            by Horsa Insight
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="email"
              style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="nome@horsa.com"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '14px',
                color: '#f5f5f5',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#0a84ff')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
            />
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="password"
              style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '14px',
                color: '#f5f5f5',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#0a84ff')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                backgroundColor: 'rgba(255,59,48,0.1)',
                border: '0.5px solid rgba(255,59,48,0.25)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '13px',
                color: '#ff6b6b',
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            style={{
              marginTop: '4px',
              backgroundColor: isPending
                ? 'rgba(10,132,255,0.5)'
                : btnHover
                ? '#0077ed'
                : '#0a84ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: isPending ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
              fontFamily: 'inherit',
              width: '100%',
            }}
          >
            {isPending ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  )
}
