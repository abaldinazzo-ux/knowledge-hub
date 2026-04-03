import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role: string = user.user_metadata?.role ?? 'user'
  const displayName: string =
    user.user_metadata?.full_name ?? user.email ?? 'Utente'

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0a0a0a', overflow: 'hidden' }}>
      <Sidebar role={role} displayName={displayName} />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}
