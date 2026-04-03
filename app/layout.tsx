import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Knowledge Hub — Horsa Insight',
  description: 'Piattaforma interna per consulenti analytics',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="it" className="dark">
      <body style={{ backgroundColor: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </body>
    </html>
  )
}
