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

  const { text, project_type } = await req.json()

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: 'Rispondi SOLO con JSON valido.',
      messages: [
        {
          role: 'user',
          content: `Analizza questo testo e identifica elementi classificabili.
Nodi disponibili: kpi, dim, users, stakeholders, data, period, pain, vincoli
Testo: ${text}
JSON: { "items": [{ "text": "elemento", "node": "pain", "confidence": 0.8 }] }
Solo elementi con confidence > 0.7. Max 3 items.`,
        },
      ],
    }),
  })

  const data = await response.json()
  const result = data.content[0].text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  return new Response(result, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
