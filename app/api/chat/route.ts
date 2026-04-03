import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('=== /api/chat called ===')

  const body = await request.json()
  const { message, conversation_id, filter } = body
  console.log('Message:', message)
  console.log('Conversation ID:', conversation_id)

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  console.log('Session:', session ? 'OK' : 'NOT FOUND')

  if (!session) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
    })
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({
        message,
        conversation_id,
        filters:
          filter && filter !== 'Tutti' ? { industry: filter } : undefined,
      }),
    }
  )

  console.log('Edge Function status:', response.status)

  if (!response.ok) {
    const error = await response.text()
    console.error('Edge Function error:', error)
    return new Response(JSON.stringify({ error }), { status: response.status })
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
