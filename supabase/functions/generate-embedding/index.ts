import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { text } = await req.json()

  const session = new Supabase.ai.Session('gte-small')
  const embedding = await session.run(text, {
    mean_pool: true,
    normalize: true,
  })

  return new Response(
    JSON.stringify({ embedding }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
